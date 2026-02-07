import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import customersRouter from './routes/customers.js';
import bannersRouter from './routes/banners.js';
import collectionsRouter from './routes/collections.js';
import categoriesRouter from './routes/categories.js';
import promocodesRouter from './routes/promocodes.js';
import discountsRouter from './routes/discounts.js';
import settingsRouter from './routes/settings.js';
import statsRouter from './routes/stats.js';
import authRouter from './routes/auth.js';
import uploadsRouter from './routes/uploads.js';
import subscribersRouter from './routes/subscribers.js';
import emailRouter from './routes/email.js';
import newslettersRouter from './routes/newsletters.js';
import contentRouter from './routes/content.js';
import { runUploadsCleanup } from './services/uploads-cleanup.js';
import { initAuthTables, requireAdmin } from './services/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_TOKEN_BYTES = 32;

const cacheStore = new Map();
const CACHE_TTL_MS = parseInt(process.env.API_CACHE_TTL_MS || '60000', 10);
const cacheAllowList = [
    /^\/api\/products(\b|\/|\?)/,
    /^\/api\/categories(\b|\/|\?)/,
    /^\/api\/collections(\b|\/|\?)/,
    /^\/api\/banners(\b|\/|\?)/,
    /^\/api\/content(\b|\/|\?)/,
    /^\/api\/stats\/dashboard(\b|\/|\?)/
];

const getCacheKey = (req) => `${req.method}:${req.originalUrl}`;

const getCachedResponse = (key) => {
    const cached = cacheStore.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
        cacheStore.delete(key);
        return null;
    }
    return cached;
};

const setCachedResponse = (key, payload, ttlMs = CACHE_TTL_MS) => {
    cacheStore.set(key, {
        payload,
        expiresAt: Date.now() + ttlMs
    });
};

const invalidateCache = (prefixes) => {
    const keys = Array.from(cacheStore.keys());
    keys.forEach((key) => {
        if (prefixes.some(prefix => key.includes(prefix))) {
            cacheStore.delete(key);
        }
    });
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

const getSecureCookieFlag = (req) => {
    const isProd = process.env.NODE_ENV === 'production';
    const isSecureRequest = req.secure || req.headers['x-forwarded-proto'] === 'https';
    return isProd && isSecureRequest;
};

const baseCspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https:",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "connect-src 'self'",
    "object-src 'none'"
];

app.use((req, res, next) => {
    const cspDirectives = [...baseCspDirectives];
    if (getSecureCookieFlag(req)) {
        cspDirectives.push('upgrade-insecure-requests');
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

    if (getSecureCookieFlag(req)) {
        res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }

    next();
});

app.use((req, res, next) => {
    if (!req.path.startsWith('/admin')) return next();

    const existingToken = req.cookies?.[CSRF_COOKIE];
    if (!existingToken) {
        const token = crypto.randomBytes(CSRF_TOKEN_BYTES).toString('hex');
        res.cookie(CSRF_COOKIE, token, {
            httpOnly: false,
            sameSite: 'lax',
            secure: getSecureCookieFlag(req)
        });
    }

    next();
});

app.use('/api', (req, res, next) => {
    const method = req.method.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

    const hasAdminSession = !!(req.cookies?.accessToken || req.cookies?.refreshToken);
    if (!hasAdminSession) return next();

    const openPaths = new Set([
        '/auth/login',
        '/auth/refresh',
        '/auth/2fa/verify-login',
        '/auth/2fa/resend-login'
    ]);

    if (openPaths.has(req.path)) return next();

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.get(CSRF_HEADER);

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({ success: false, message: 'Invalid CSRF token.' });
    }

    return next();
});

app.use((req, res, next) => {
    const requestId = crypto.randomUUID();
    const start = process.hrtime.bigint();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms id=${requestId}`
        );
    });

    next();
});

app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (!cacheAllowList.some(pattern => pattern.test(req.originalUrl))) return next();
    if (req.query && req.query.nocache === '1') return next();

    const key = getCacheKey(req);
    const cached = getCachedResponse(key);
    if (!cached) return next();

    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Content-Type', 'application/json');
    return res.send(cached.payload);
});

// Static files (serve frontend)
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, '../public/robots.txt')));
app.get('/sitemap.xml', (req, res) => res.sendFile(path.join(__dirname, '../public/sitemap.xml')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/products', (req, res, next) => {
    res.sendResponse = res.send;
    res.send = (body) => {
        if (req.method === 'GET' && cacheAllowList.some(pattern => pattern.test(req.originalUrl))) {
            setCachedResponse(getCacheKey(req), body);
            res.setHeader('X-Cache', 'MISS');
        } else if (req.method !== 'GET') {
            invalidateCache(['/api/products']);
        }
        return res.sendResponse(body);
    };
    next();
}, productsRouter);
app.use('/api/orders', (req, res, next) => {
    if (req.method !== 'GET') {
        invalidateCache(['/api/orders', '/api/stats']);
    }
    next();
}, ordersRouter);
app.use('/api/customers', (req, res, next) => {
    if (req.method !== 'GET') {
        invalidateCache(['/api/customers', '/api/stats']);
    }
    next();
}, customersRouter);
app.use('/api/banners', (req, res, next) => {
    res.sendResponse = res.send;
    res.send = (body) => {
        if (req.method === 'GET' && cacheAllowList.some(pattern => pattern.test(req.originalUrl))) {
            setCachedResponse(getCacheKey(req), body);
            res.setHeader('X-Cache', 'MISS');
        } else if (req.method !== 'GET') {
            invalidateCache(['/api/banners']);
        }
        return res.sendResponse(body);
    };
    next();
}, bannersRouter);
app.use('/api/collections', (req, res, next) => {
    res.sendResponse = res.send;
    res.send = (body) => {
        if (req.method === 'GET' && cacheAllowList.some(pattern => pattern.test(req.originalUrl))) {
            setCachedResponse(getCacheKey(req), body);
            res.setHeader('X-Cache', 'MISS');
        } else if (req.method !== 'GET') {
            invalidateCache(['/api/collections']);
        }
        return res.sendResponse(body);
    };
    next();
}, collectionsRouter);
app.use('/api/categories', (req, res, next) => {
    res.sendResponse = res.send;
    res.send = (body) => {
        if (req.method === 'GET' && cacheAllowList.some(pattern => pattern.test(req.originalUrl))) {
            setCachedResponse(getCacheKey(req), body);
            res.setHeader('X-Cache', 'MISS');
        } else if (req.method !== 'GET') {
            invalidateCache(['/api/categories']);
        }
        return res.sendResponse(body);
    };
    next();
}, categoriesRouter);
dotenv.config({ path: path.join(__dirname, '.env') });
app.use('/api/promocodes', promocodesRouter);
app.use('/api/discounts', (req, res, next) => {
    if (req.method !== 'GET') {
        invalidateCache(['/api/discounts']);
    }
    next();
}, discountsRouter);
app.use('/api/settings', (req, res, next) => {
    if (req.method !== 'GET') {
        invalidateCache(['/api/settings']);
    }
    next();
}, settingsRouter);
app.use('/api/stats', (req, res, next) => {
    res.sendResponse = res.send;
    res.send = (body) => {
        if (req.method === 'GET' && cacheAllowList.some(pattern => pattern.test(req.originalUrl))) {
            setCachedResponse(getCacheKey(req), body);
            res.setHeader('X-Cache', 'MISS');
        }
        return res.sendResponse(body);
    };
    next();
}, statsRouter);
app.use('/api/subscribers', subscribersRouter);
app.use('/api/email', emailRouter);
app.use('/api/newsletters', newslettersRouter);
app.use('/api/content', (req, res, next) => {
    res.sendResponse = res.send;
    res.send = (body) => {
        if (req.method === 'GET' && cacheAllowList.some(pattern => pattern.test(req.originalUrl))) {
            setCachedResponse(getCacheKey(req), body);
            res.setHeader('X-Cache', 'MISS');
        } else if (req.method !== 'GET') {
            invalidateCache(['/api/content']);
        }
        return res.sendResponse(body);
    };
    next();
}, contentRouter);

// Admin auth (UI gate)
// Page routes (without .html extension)
// Error pages routes
app.get('/error', (req, res) => {
    const code = req.query.code || '500';
    res.status(parseInt(code)).sendFile(path.join(__dirname, '../views', 'error.html'));
});

app.get('/maintenance', (req, res) => {
    res.status(503).sendFile(path.join(__dirname, '../views', 'maintenance.html'));
});



// Error Handler - обработка серверных ошибок
app.use((err, req, res, next) => {
    console.error('Server Error:', err.stack);
    res.status(err.status || 500).sendFile(path.join(__dirname, '../views', 'error.html'));
});
// Frontend pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../views/index.html')));
app.get('/catalog', (req, res) => res.sendFile(path.join(__dirname, '../views/catalog.html')));
app.get('/product', (req, res) => res.sendFile(path.join(__dirname, '../views/product.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, '../views/cart.html')));
app.get('/collection', (req, res) => res.sendFile(path.join(__dirname, '../views/collection.html')));
app.get('/wishlist', (req, res) => res.sendFile(path.join(__dirname, '../views/wishlist.html')));
app.get('/delivery', (req, res) => res.sendFile(path.join(__dirname, '../views/delivery.html')));
app.get('/payment', (req, res) => res.sendFile(path.join(__dirname, '../views/payment.html')));
app.get('/returns', (req, res) => res.sendFile(path.join(__dirname, '../views/returns.html')));
app.get('/faq', (req, res) => res.sendFile(path.join(__dirname, '../views/faq.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, '../views/privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, '../views/terms.html')));
app.get('/contacts', (req, res) => res.sendFile(path.join(__dirname, '../views/contacts.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, '../views/about.html')));

// Admin pages
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, '../admin/login.html')));
app.get('/admin', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/index.html')));
app.get('/admin/products', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/products.html')));
app.get('/admin/product-edit', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/product-edit.html')));
app.get('/admin/orders', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/orders.html')));
app.get('/admin/order-view', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/order-view.html')));
app.get('/admin/customer-view', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/customer-view.html')));
app.get('/admin/customers', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/customers.html')));
app.get('/admin/banners', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/banners.html')));
app.get('/admin/collections', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/collections.html')));
app.get('/admin/categories', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/categories.html')));
app.get('/admin/promocodes', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/promocodes.html')));
app.get('/admin/discounts', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/discounts.html')));
app.get('/admin/newsletters', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/newsletters.html')));
app.get('/admin/settings', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/settings.html')));
app.get('/admin/pages', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../admin/pages.html')));

// Admin assets (protect everything except login and its CSS)
app.use('/admin', (req, res, next) => {
    const openPaths = new Set(['/login', '/login.html', '/styles.css']);
    if (openPaths.has(req.path)) {
        return next();
    }
    return requireAdmin(req, res, next);
}, express.static(path.join(__dirname, '../admin')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Higher Waist API is running',
        uptimeSec: Math.round(process.uptime()),
        cacheEntries: cacheStore.size,
        memory: {
            rss: process.memoryUsage().rss,
            heapUsed: process.memoryUsage().heapUsed
        }
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('API Error:', {
        requestId: req.requestId,
        path: req.originalUrl,
        method: req.method,
        message: err.message
    });
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
// 404 Handler - должен быть после всех роутов
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../views', '404.html'));
});
// Start server
const startServer = async () => {
    try {
        await initAuthTables();
        app.listen(PORT, () => {
            console.log(`🚀 Higher Waist Server running on http://localhost:${PORT}`);
            console.log(`📊 API: http://localhost:${PORT}/api`);
            console.log(`🌐 Frontend: http://localhost:${PORT}/views/index.html`);
        });

        const cleanupIntervalMs = 24 * 60 * 60 * 1000;
        setInterval(() => {
            runUploadsCleanup({ type: 'all' })
                .then(result => console.log('🧹 Upload cleanup finished:', result))
                .catch(error => console.warn('Upload cleanup failed:', error.message));
        }, cleanupIntervalMs);
    } catch (error) {
        console.error('Failed to initialize auth tables:', error);
        process.exit(1);
    }
};

startServer();
