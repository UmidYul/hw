import express from 'express';
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
import { initAuthTables, requireAdmin } from './services/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files (serve frontend)
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, '../public/robots.txt')));
app.get('/sitemap.xml', (req, res) => res.sendFile(path.join(__dirname, '../public/sitemap.xml')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/categories', categoriesRouter);
dotenv.config({ path: path.join(__dirname, '.env') });
app.use('/api/promocodes', promocodesRouter);
app.use('/api/discounts', discountsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/subscribers', subscribersRouter);
app.use('/api/email', emailRouter);
app.use('/api/newsletters', newslettersRouter);

// Admin auth (UI gate)
// Page routes (without .html extension)
// Frontend pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../views/index.html')));
app.get('/catalog', (req, res) => res.sendFile(path.join(__dirname, '../views/catalog.html')));
app.get('/product', (req, res) => res.sendFile(path.join(__dirname, '../views/product.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, '../views/cart.html')));
app.get('/collection', (req, res) => res.sendFile(path.join(__dirname, '../views/collection.html')));
app.get('/wishlist', (req, res) => res.sendFile(path.join(__dirname, '../views/wishlist.html')));

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
    res.json({ status: 'ok', message: 'Higher Waist API is running' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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
    } catch (error) {
        console.error('Failed to initialize auth tables:', error);
        process.exit(1);
    }
};

startServer();
