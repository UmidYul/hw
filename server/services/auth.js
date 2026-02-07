import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { dbGet, dbRun } from '../database/db.js';

const ACCESS_TTL_SECONDS = parseInt(process.env.ACCESS_TOKEN_TTL || '900', 10);
const REFRESH_TTL_SECONDS = parseInt(process.env.REFRESH_TOKEN_TTL || '604800', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const LOGIN_LIMIT = {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 10
};

const loginAttempts = new Map();

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const buildAccessToken = (user) => {
    return jwt.sign(
        {
            sub: user.id,
            username: user.username,
            role: user.role || 'admin'
        },
        JWT_SECRET,
        { expiresIn: ACCESS_TTL_SECONDS }
    );
};

const buildRefreshToken = () => crypto.randomBytes(64).toString('hex');

const setAuthCookies = (req, res, accessToken, refreshToken) => {
    const isProd = process.env.NODE_ENV === 'production';
    const isSecureRequest = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const secureCookies = isProd && isSecureRequest;

    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookies,
        maxAge: ACCESS_TTL_SECONDS * 1000
    });

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookies,
        maxAge: REFRESH_TTL_SECONDS * 1000
    });
};

const clearAuthCookies = (res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
};

const denyAccess = (req, res) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    return res.redirect('/admin/login');
};

const noteLoginAttempt = (ip) => {
    const now = Date.now();
    const entry = loginAttempts.get(ip);

    if (!entry || now - entry.firstAttempt > LOGIN_LIMIT.windowMs) {
        loginAttempts.set(ip, { count: 1, firstAttempt: now });
        return;
    }

    entry.count += 1;
    loginAttempts.set(ip, entry);
};

const isRateLimited = (ip) => {
    const entry = loginAttempts.get(ip);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.firstAttempt > LOGIN_LIMIT.windowMs) {
        loginAttempts.delete(ip);
        return false;
    }

    return entry.count >= LOGIN_LIMIT.maxAttempts;
};

export const initAuthTables = async () => {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id UUID PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            is_active BOOLEAN DEFAULT TRUE,
            last_login TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            revoked_at TIMESTAMPTZ,
            replaced_by TEXT,
            ip TEXT,
            user_agent TEXT,
            FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
        )
    `);

    await dbRun(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'refresh_tokens'
                  AND column_name = 'legacy_user_id'
            ) THEN
                EXECUTE 'ALTER TABLE refresh_tokens ALTER COLUMN legacy_user_id DROP NOT NULL';
            END IF;
        END $$;
    `);

    const existing = await dbGet('SELECT id FROM admin_users LIMIT 1');
    if (!existing) {
        const seedUser = process.env.ADMIN_USER || 'admin';
        const seedPass = process.env.ADMIN_PASS || 'admin';
        const hash = await bcrypt.hash(seedPass, 12);
        const adminId = crypto.randomUUID();
        await dbRun(
            'INSERT INTO admin_users (id, username, password_hash) VALUES (?, ?, ?)',
            [adminId, seedUser, hash]
        );
    }
};

const getAdminUserByUsername = async (username) => {
    return dbGet('SELECT * FROM admin_users WHERE username = ? AND is_active = true', [username]);
};

const getAdminUserById = async (id) => {
    return dbGet('SELECT * FROM admin_users WHERE id = ? AND is_active = true', [id]);
};

const getAdminFromRequest = async (req) => {
    const accessToken = req.cookies?.accessToken;
    if (accessToken) {
        try {
            const decoded = jwt.verify(accessToken, JWT_SECRET);
            const user = await getAdminUserById(decoded.sub);
            if (user) return user;
        } catch (error) {
            if (error.name !== 'TokenExpiredError') {
                return null;
            }
        }
    }

    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return null;

    const { record } = await findRefreshToken(refreshToken);
    if (!record || isRefreshExpired(record)) return null;

    return getAdminUserById(record.user_id);
};

const storeRefreshToken = async (userId, token, req) => {
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000).toISOString();
    const tokenHash = hashToken(token);

    const refreshId = crypto.randomUUID();
    await dbRun(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`
        , [
            refreshId,
            userId,
            tokenHash,
            expiresAt,
            req.ip,
            req.get('user-agent') || ''
        ]
    );

    return tokenHash;
};

const revokeRefreshToken = async (tokenHash, replacedBy = null) => {
    await dbRun(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP, replaced_by = ?
         WHERE token_hash = ? AND revoked_at IS NULL`,
        [replacedBy, tokenHash]
    );
};

const findRefreshToken = async (token) => {
    const tokenHash = hashToken(token);
    const record = await dbGet(
        'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL',
        [tokenHash]
    );
    return { tokenHash, record };
};

const isRefreshExpired = (record) => {
    if (!record || !record.expires_at) return true;
    return new Date(record.expires_at).getTime() <= Date.now();
};

const issueTokens = async (user, req, res, previousTokenHash = null) => {
    const accessToken = buildAccessToken(user);
    const refreshToken = buildRefreshToken();
    const newTokenHash = await storeRefreshToken(user.id, refreshToken, req);

    if (previousTokenHash) {
        await revokeRefreshToken(previousTokenHash, newTokenHash);
    }

    setAuthCookies(req, res, accessToken, refreshToken);
};

export const login = async (req, res) => {
    const ip = req.ip;
    if (isRateLimited(ip)) {
        return res.status(429).json({ success: false, message: 'Слишком много попыток, попробуйте позже.' });
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Введите логин и пароль.' });
    }

    const user = await getAdminUserByUsername(username);
    if (!user) {
        noteLoginAttempt(ip);
        return res.status(401).json({ success: false, message: 'Неверные данные.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        noteLoginAttempt(ip);
        return res.status(401).json({ success: false, message: 'Неверные данные.' });
    }

    await dbRun('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    await issueTokens(user, req, res);

    return res.json({ success: true });
};

export const refresh = async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ success: false });
    }

    const { tokenHash, record } = await findRefreshToken(refreshToken);
    if (!record || isRefreshExpired(record)) {
        if (record) {
            await revokeRefreshToken(tokenHash);
        }
        clearAuthCookies(res);
        return res.status(401).json({ success: false });
    }

    const user = await getAdminUserById(record.user_id);
    if (!user) {
        await revokeRefreshToken(tokenHash);
        clearAuthCookies(res);
        return res.status(401).json({ success: false });
    }

    await issueTokens(user, req, res, tokenHash);
    return res.json({ success: true });
};

export const logout = async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        await revokeRefreshToken(tokenHash);
    }
    clearAuthCookies(res);
    return res.json({ success: true });
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body || {};
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Заполните все поля.' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Пароли не совпадают.' });
        }

        if (String(newPassword).length < 6) {
            return res.status(400).json({ success: false, message: 'Пароль должен быть не короче 6 символов.' });
        }

        const user = await getAdminFromRequest(req);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const valid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!valid) {
            return res.status(400).json({ success: false, message: 'Неверный текущий пароль.' });
        }

        const samePassword = await bcrypt.compare(newPassword, user.password_hash);
        if (samePassword) {
            return res.status(400).json({ success: false, message: 'Новый пароль должен отличаться от текущего.' });
        }

        const nextHash = await bcrypt.hash(newPassword, 12);
        await dbRun(
            'UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [nextHash, user.id]
        );

        return res.json({ success: true, message: 'Пароль обновлен.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const requireAdmin = async (req, res, next) => {
    const accessToken = req.cookies?.accessToken;
    if (accessToken) {
        try {
            jwt.verify(accessToken, JWT_SECRET);
            return next();
        } catch (error) {
            if (error.name !== 'TokenExpiredError') {
                return denyAccess(req, res);
            }
        }
    }

    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return denyAccess(req, res);
    }

    const { tokenHash, record } = await findRefreshToken(refreshToken);
    if (!record || isRefreshExpired(record)) {
        if (record) {
            await revokeRefreshToken(tokenHash);
        }
        clearAuthCookies(res);
        return denyAccess(req, res);
    }

    const user = await getAdminUserById(record.user_id);
    if (!user) {
        await revokeRefreshToken(tokenHash);
        clearAuthCookies(res);
        return denyAccess(req, res);
    }

    await issueTokens(user, req, res, tokenHash);
    return next();
};
