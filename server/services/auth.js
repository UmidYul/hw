import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { dbGet, dbRun } from '../database/db.js';
import { sendAdminTwoFactorEmail } from './email.js';

const ACCESS_TTL_SECONDS = parseInt(process.env.ACCESS_TOKEN_TTL || '900', 10);
const REFRESH_TTL_SECONDS = parseInt(process.env.REFRESH_TOKEN_TTL || '604800', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const LOGIN_LIMIT = {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 10
};

const TWO_FACTOR_CODE_TTL_MINUTES = parseInt(process.env.TWO_FACTOR_CODE_TTL_MINUTES || '10', 10);
const TWO_FACTOR_MAX_ATTEMPTS = parseInt(process.env.TWO_FACTOR_MAX_ATTEMPTS || '5', 10);
const TWO_FACTOR_SEND_COOLDOWN_SECONDS = parseInt(process.env.TWO_FACTOR_SEND_COOLDOWN_SECONDS || '60', 10);

const loginAttempts = new Map();

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');
const createVerificationCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

const maskEmail = (email) => {
    const value = String(email || '').trim();
    const atIndex = value.indexOf('@');
    if (atIndex <= 1) return value;
    const local = value.slice(0, atIndex);
    const domain = value.slice(atIndex + 1);
    const first = local.slice(0, 2);
    const last = local.slice(-1);
    return `${first}${'*'.repeat(Math.max(local.length - 3, 1))}${last}@${domain}`;
};

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
            two_factor_enabled BOOLEAN DEFAULT FALSE,
            two_factor_email TEXT,
            two_factor_verified BOOLEAN DEFAULT FALSE,
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
        CREATE TABLE IF NOT EXISTS admin_two_factor_tokens (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL,
            code_hash TEXT NOT NULL,
            purpose TEXT NOT NULL,
            email TEXT,
            attempts INTEGER DEFAULT 0,
            last_sent_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ NOT NULL,
            consumed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
        )
    `);

    await dbRun('ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE');
    await dbRun('ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS two_factor_email TEXT');
    await dbRun('ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS two_factor_verified BOOLEAN DEFAULT FALSE');
    await dbRun('ALTER TABLE admin_two_factor_tokens ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ');

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

const isTwoFactorExpired = (record) => {
    if (!record || !record.expires_at) return true;
    return new Date(record.expires_at).getTime() <= Date.now();
};

const getCooldownRemainingSeconds = (record) => {
    if (!record?.last_sent_at) return 0;
    const lastSent = new Date(record.last_sent_at).getTime();
    if (Number.isNaN(lastSent)) return 0;
    const elapsedMs = Date.now() - lastSent;
    const cooldownMs = TWO_FACTOR_SEND_COOLDOWN_SECONDS * 1000;
    if (elapsedMs >= cooldownMs) return 0;
    return Math.ceil((cooldownMs - elapsedMs) / 1000);
};

const getLatestTwoFactorToken = async (userId, purpose) => {
    return dbGet(
        `SELECT * FROM admin_two_factor_tokens
         WHERE user_id = ? AND purpose = ?
         ORDER BY last_sent_at DESC NULLS LAST, created_at DESC
         LIMIT 1`,
        [userId, purpose]
    );
};

const checkTwoFactorCooldown = async (userId, purpose) => {
    const latest = await getLatestTwoFactorToken(userId, purpose);
    const remaining = getCooldownRemainingSeconds(latest);
    if (remaining > 0) {
        return { ok: false, remaining };
    }
    return { ok: true, remaining: 0 };
};

const createTwoFactorToken = async ({ userId, purpose, email }) => {
    const code = createVerificationCode();
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TWO_FACTOR_CODE_TTL_MINUTES * 60 * 1000).toISOString();

    await dbRun(
        `INSERT INTO admin_two_factor_tokens (id, user_id, code_hash, purpose, email, last_sent_at, expires_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`
        , [tokenId, userId, hashCode(code), purpose, email || null, expiresAt]
    );

    return { tokenId, code, expiresAt };
};

const refreshTwoFactorToken = async (tokenId) => {
    const code = createVerificationCode();
    const expiresAt = new Date(Date.now() + TWO_FACTOR_CODE_TTL_MINUTES * 60 * 1000).toISOString();

    await dbRun(
        'UPDATE admin_two_factor_tokens SET code_hash = ?, expires_at = ?, attempts = 0, consumed_at = NULL, last_sent_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashCode(code), expiresAt, tokenId]
    );

    return { code, expiresAt };
};

const verifyTwoFactorToken = async ({ tokenId, code, purpose }) => {
    const record = await dbGet('SELECT * FROM admin_two_factor_tokens WHERE id = ?', [tokenId]);
    if (!record || record.purpose !== purpose) {
        return { ok: false, message: 'Код не найден.' };
    }

    if (record.consumed_at) {
        return { ok: false, message: 'Код уже использован.' };
    }

    if (isTwoFactorExpired(record)) {
        return { ok: false, message: 'Код истек. Запросите новый.' };
    }

    if ((record.attempts || 0) >= TWO_FACTOR_MAX_ATTEMPTS) {
        return { ok: false, message: 'Превышено число попыток.' };
    }

    const matches = hashCode(code) === record.code_hash;
    if (!matches) {
        await dbRun('UPDATE admin_two_factor_tokens SET attempts = attempts + 1 WHERE id = ?', [tokenId]);
        return { ok: false, message: 'Неверный код.' };
    }

    await dbRun(
        'UPDATE admin_two_factor_tokens SET consumed_at = CURRENT_TIMESTAMP, attempts = attempts + 1 WHERE id = ?',
        [tokenId]
    );

    return { ok: true, record };
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

    if (user.two_factor_enabled && !user.two_factor_email) {
        return res.status(400).json({ success: false, message: '2FA включена, но email не задан.' });
    }

    if (user.two_factor_enabled && user.two_factor_email) {
        const cooldown = await checkTwoFactorCooldown(user.id, 'login');
        if (!cooldown.ok) {
            return res.status(429).json({
                success: false,
                message: `Повторите попытку через ${cooldown.remaining} сек.`
            });
        }

        const { tokenId, code } = await createTwoFactorToken({
            userId: user.id,
            purpose: 'login',
            email: user.two_factor_email
        });

        const sent = await sendAdminTwoFactorEmail({
            to: user.two_factor_email,
            code,
            reason: 'login'
        });

        if (!sent) {
            return res.status(503).json({ success: false, message: 'Почтовый сервер не настроен.' });
        }

        return res.json({
            success: true,
            requires2fa: true,
            challengeId: tokenId,
            delivery: { method: 'email', target: maskEmail(user.two_factor_email) }
        });
    }

    await dbRun('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    await issueTokens(user, req, res);

    return res.json({ success: true });
};

export const verifyTwoFactorLogin = async (req, res) => {
    const { challengeId, code } = req.body || {};
    if (!challengeId || !code) {
        return res.status(400).json({ success: false, message: 'Введите код.' });
    }

    const result = await verifyTwoFactorToken({ tokenId: challengeId, code, purpose: 'login' });
    if (!result.ok) {
        return res.status(401).json({ success: false, message: result.message });
    }

    const user = await getAdminUserById(result.record.user_id);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Пользователь не найден.' });
    }

    await dbRun('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    await issueTokens(user, req, res);
    return res.json({ success: true });
};

export const resendTwoFactorLogin = async (req, res) => {
    const { challengeId } = req.body || {};
    if (!challengeId) {
        return res.status(400).json({ success: false, message: 'Запросите код повторно.' });
    }

    const record = await dbGet('SELECT * FROM admin_two_factor_tokens WHERE id = ?', [challengeId]);
    if (!record || record.purpose !== 'login') {
        return res.status(404).json({ success: false, message: 'Код не найден.' });
    }

    if (record.consumed_at) {
        return res.status(400).json({ success: false, message: 'Код уже использован.' });
    }

    const user = await getAdminUserById(record.user_id);
    if (!user || !user.two_factor_enabled || !record.email) {
        return res.status(400).json({ success: false, message: '2FA недоступна.' });
    }

    const remaining = getCooldownRemainingSeconds(record);
    if (remaining > 0) {
        return res.status(429).json({
            success: false,
            message: `Повторите попытку через ${remaining} сек.`
        });
    }

    let tokenId = record.id;
    let code;
    if (isTwoFactorExpired(record)) {
        const created = await createTwoFactorToken({
            userId: user.id,
            purpose: 'login',
            email: record.email
        });
        tokenId = created.tokenId;
        code = created.code;
    } else {
        const refreshed = await refreshTwoFactorToken(record.id);
        code = refreshed.code;
    }

    const sent = await sendAdminTwoFactorEmail({ to: record.email, code, reason: 'login' });
    if (!sent) {
        return res.status(503).json({ success: false, message: 'Почтовый сервер не настроен.' });
    }

    return res.json({
        success: true,
        challengeId: tokenId,
        delivery: { method: 'email', target: maskEmail(record.email) }
    });
};

export const getTwoFactorSettings = async (req, res) => {
    const user = await getAdminFromRequest(req);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    return res.json({
        enabled: !!user.two_factor_enabled,
        email: user.two_factor_email || '',
        verified: !!user.two_factor_verified,
        emailMasked: user.two_factor_email ? maskEmail(user.two_factor_email) : ''
    });
};

export const sendTwoFactorSetupCode = async (req, res) => {
    const user = await getAdminFromRequest(req);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const email = String(req.body?.email || '').trim();
    const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!emailValid) {
        return res.status(400).json({ success: false, message: 'Введите корректный email.' });
    }

    const cooldown = await checkTwoFactorCooldown(user.id, 'setup');
    if (!cooldown.ok) {
        return res.status(429).json({
            success: false,
            message: `Повторите попытку через ${cooldown.remaining} сек.`
        });
    }

    const { tokenId, code } = await createTwoFactorToken({
        userId: user.id,
        purpose: 'setup',
        email
    });

    const sent = await sendAdminTwoFactorEmail({
        to: email,
        code,
        reason: 'setup'
    });

    if (!sent) {
        return res.status(503).json({ success: false, message: 'Почтовый сервер не настроен.' });
    }

    return res.json({
        success: true,
        challengeId: tokenId,
        delivery: { method: 'email', target: maskEmail(email) }
    });
};

export const confirmTwoFactorSetup = async (req, res) => {
    const user = await getAdminFromRequest(req);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { challengeId, code } = req.body || {};
    if (!challengeId || !code) {
        return res.status(400).json({ success: false, message: 'Введите код.' });
    }

    const result = await verifyTwoFactorToken({ tokenId: challengeId, code, purpose: 'setup' });
    if (!result.ok) {
        return res.status(400).json({ success: false, message: result.message });
    }

    if (result.record.user_id !== user.id) {
        return res.status(403).json({ success: false, message: 'Недостаточно прав.' });
    }

    await dbRun(
        'UPDATE admin_users SET two_factor_enabled = TRUE, two_factor_email = ?, two_factor_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [result.record.email, user.id]
    );

    return res.json({ success: true, enabled: true, email: result.record.email });
};

export const disableTwoFactor = async (req, res) => {
    const user = await getAdminFromRequest(req);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await dbRun(
        'UPDATE admin_users SET two_factor_enabled = FALSE, two_factor_verified = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
    );

    return res.json({ success: true, enabled: false });
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
