import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files (serve frontend)
app.use(express.static(path.join(__dirname, '..')));
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// API Routes
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/promocodes', promocodesRouter);
app.use('/api/discounts', discountsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/stats', statsRouter);

// Page routes (without .html extension)
// Frontend pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../views/index.html')));
app.get('/catalog', (req, res) => res.sendFile(path.join(__dirname, '../views/catalog.html')));
app.get('/product', (req, res) => res.sendFile(path.join(__dirname, '../views/product.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, '../views/cart.html')));
app.get('/collection', (req, res) => res.sendFile(path.join(__dirname, '../views/collection.html')));
app.get('/wishlist', (req, res) => res.sendFile(path.join(__dirname, '../views/wishlist.html')));

// Admin pages
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../admin/index.html')));
app.get('/admin/products', (req, res) => res.sendFile(path.join(__dirname, '../admin/products.html')));
app.get('/admin/product-edit', (req, res) => res.sendFile(path.join(__dirname, '../admin/product-edit.html')));
app.get('/admin/orders', (req, res) => res.sendFile(path.join(__dirname, '../admin/orders.html')));
app.get('/admin/order-view', (req, res) => res.sendFile(path.join(__dirname, '../admin/order-view.html')));
app.get('/admin/customers', (req, res) => res.sendFile(path.join(__dirname, '../admin/customers.html')));
app.get('/admin/banners', (req, res) => res.sendFile(path.join(__dirname, '../admin/banners.html')));
app.get('/admin/collections', (req, res) => res.sendFile(path.join(__dirname, '../admin/collections.html')));
app.get('/admin/categories', (req, res) => res.sendFile(path.join(__dirname, '../admin/categories.html')));
app.get('/admin/promocodes', (req, res) => res.sendFile(path.join(__dirname, '../admin/promocodes.html')));
app.get('/admin/discounts', (req, res) => res.sendFile(path.join(__dirname, '../admin/discounts.html')));
app.get('/admin/settings', (req, res) => res.sendFile(path.join(__dirname, '../admin/settings.html')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'AURA API is running' });
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
app.listen(PORT, () => {
    console.log(`🚀 AURA Server running on http://localhost:${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend: http://localhost:${PORT}/views/index.html`);
});
