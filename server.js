const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve admin panel static files
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Routes for HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/catalog', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'catalog.html'));
});

app.get('/catalog.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'catalog.html'));
});

app.get('/product', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'product.html'));
});

app.get('/product.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'product.html'));
});

app.get('/cart', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'cart.html'));
});

app.get('/cart.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'cart.html'));
});

app.get('/delivery', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'delivery.html'));
});

app.get('/payment', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'payment.html'));
});

app.get('/returns', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'returns.html'));
});

app.get('/faq', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'faq.html'));
});

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'privacy.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'terms.html'));
});

app.get('/contacts', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'contacts.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'about.html'));
});

// Admin panel routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🎨 Higher Waist E-commerce сайт запущен!`);
    console.log(`\n📍 Откройте в браузере: http://localhost:${PORT}`);
    console.log(`\n📄 Доступные страницы:`);
    console.log(`   • Главная:    http://localhost:${PORT}/`);
    console.log(`   • Каталог:    http://localhost:${PORT}/catalog.html`);
    console.log(`   • Товар:      http://localhost:${PORT}/product.html?id=1`);
    console.log(`   • Корзина:    http://localhost:${PORT}/cart.html`);
    console.log(`   • Админ:      http://localhost:${PORT}/admin`);
    console.log(`\n💡 Для остановки нажмите Ctrl+C\n`);
});
