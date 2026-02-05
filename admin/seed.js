// ========================================
// AURA Admin Panel - Seed Data
// Initialize demo data on first load
// ========================================

function seedData() {
    if (REPO.isInitialized()) {
        console.log('Admin already initialized');
        return;
    }

    console.log('Initializing admin with seed data...');

    // Categories
    const categories = [
        { name: 'Outerwear', slug: 'outerwear', description: 'Coats, jackets, and outerwear', visibility: true, order: 1 },
        { name: 'Tops', slug: 'tops', description: 'T-shirts, shirts, sweaters', visibility: true, order: 2 },
        { name: 'Bottoms', slug: 'bottoms', description: 'Pants, jeans, skirts, shorts', visibility: true, order: 3 },
        { name: 'Shoes', slug: 'shoes', description: 'Footwear collection', visibility: true, order: 4 },
        { name: 'Accessories', slug: 'accessories', description: 'Bags, scarves, accessories', visibility: true, order: 5 }
    ];

    categories.forEach(cat => REPO.createCategory(cat));
    const cats = REPO.getCategories();

    // Collections
    const collections = [
        {
            name: 'New Arrivals',
            slug: 'new-arrivals',
            ruleType: 'rule',
            rule: { tag: 'New' },
            visibility: true,
            order: 1
        },
        {
            name: 'Sale Items',
            slug: 'sale',
            ruleType: 'rule',
            rule: { tag: 'Sale' },
            visibility: true,
            order: 2
        },
        {
            name: 'Essential Pieces',
            slug: 'essentials',
            ruleType: 'manual',
            productIds: [],
            visibility: true,
            order: 3
        }
    ];

    collections.forEach(col => REPO.createCollection(col));

    // Products (simplified from main store)
    const productTemplates = [
        {
            title: 'Минималистичное пальто',
            sku: 'COAT-001',
            category: cats.find(c => c.slug === 'outerwear').id,
            price: 12990,
            oldPrice: null,
            cost: 6000,
            stock: 15,
            lowStockThreshold: 5,
            status: 'active',
            tags: ['New', 'Limited'],
            colors: ['Black', 'Beige', 'Grey'],
            sizes: ['XS', 'S', 'M', 'L', 'XL'],
            images: ['https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400'],
            shortDescription: 'Элегантное пальто свободного кроя',
            fullDescription: 'Минималистичное пальто из премиальной шерсти. Свободный силуэт, качественная фурнитура.',
            material: '80% шерсть, 20% полиэстер',
            care: 'Только химчистка',
            fit: 'Oversized',
            rating: 4.8,
            reviewsCount: 142
        },
        {
            title: 'Классический тренч',
            sku: 'TRENCH-001',
            category: cats.find(c => c.slug === 'outerwear').id,
            price: 8990,
            oldPrice: 11990,
            cost: 4500,
            stock: 8,
            lowStockThreshold: 5,
            status: 'active',
            tags: ['Sale'],
            colors: ['Beige', 'Black'],
            sizes: ['S', 'M', 'L'],
            images: ['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400'],
            shortDescription: 'Вечная классика',
            fullDescription: 'Двубортный тренч классического кроя. Водоотталкивающая ткань.',
            material: '65% хлопок, 35% полиэстер',
            care: 'Машинная стирка 30°C',
            fit: 'Regular fit',
            rating: 4.7,
            reviewsCount: 98
        },
        {
            title: 'Шерстяной кардиган',
            sku: 'CARD-001',
            category: cats.find(c => c.slug === 'tops').id,
            price: 5990,
            oldPrice: null,
            cost: 3000,
            stock: 25,
            lowStockThreshold: 10,
            status: 'active',
            tags: ['New'],
            colors: ['Beige', 'Grey', 'Navy'],
            sizes: ['XS', 'S', 'M', 'L'],
            images: ['https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400'],
            shortDescription: 'Уютный кардиган',
            fullDescription: 'Мягкий кардиган из шерсти мериноса. Универсальный предмет гардероба.',
            material: '100% шерсть мериноса',
            care: 'Ручная стирка',
            fit: 'Regular fit',
            rating: 4.6,
            reviewsCount: 76
        },
        {
            title: 'Базовая футболка',
            sku: 'TEE-001',
            category: cats.find(c => c.slug === 'tops').id,
            price: 1990,
            oldPrice: null,
            cost: 800,
            stock: 50,
            lowStockThreshold: 20,
            status: 'active',
            tags: [],
            colors: ['White', 'Black', 'Grey', 'Beige'],
            sizes: ['XS', 'S', 'M', 'L', 'XL'],
            images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'],
            shortDescription: 'Premium базовая футболка',
            fullDescription: 'Базовая футболка из премиального хлопка. Идеальная посадка.',
            material: '100% органический хлопок',
            care: 'Машинная стирка 40°C',
            fit: 'Slim fit',
            rating: 4.9,
            reviewsCount: 234
        },
        {
            title: 'Прямые джинсы',
            sku: 'JEANS-001',
            category: cats.find(c => c.slug === 'bottoms').id,
            price: 5990,
            oldPrice: 7490,
            cost: 3000,
            stock: 30,
            lowStockThreshold: 15,
            status: 'active',
            tags: ['Sale'],
            colors: ['Black', 'Navy', 'Grey'],
            sizes: ['XS', 'S', 'M', 'L', 'XL'],
            images: ['https://images.unsplash.com/photo-1542272604-787c3835535d?w=400'],
            shortDescription: 'Классические прямые джинсы',
            fullDescription: 'Джинсы прямого кроя из плотного денима. Универсальная модель.',
            material: '98% хлопок, 2% эластан',
            care: 'Машинная стирка 30°C',
            fit: 'Straight fit',
            rating: 4.6,
            reviewsCount: 201
        }
    ];

    productTemplates.forEach(p => REPO.createProduct(p));

    // Promo Codes
    const promoCodes = [
        {
            code: 'WELCOME10',
            type: 'percent',
            value: 10,
            minAmount: 0,
            maxUses: null,
            perUserLimit: 1,
            excludeSale: true,
            startDate: new Date().toISOString(),
            endDate: null,
            status: 'active'
        },
        {
            code: 'SPRING15',
            type: 'percent',
            value: 15,
            minAmount: 10000,
            maxUses: 100,
            perUserLimit: 1,
            excludeSale: false,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active'
        },
        {
            code: 'FIRST1000',
            type: 'fixed',
            value: 1000,
            minAmount: 5000,
            maxUses: 50,
            perUserLimit: 1,
            excludeSale: true,
            startDate: new Date().toISOString(),
            endDate: null,
            status: 'active'
        }
    ];

    promoCodes.forEach(pc => REPO.createPromoCode(pc));

    // Discounts
    const discounts = [
        {
            name: 'Seasonal Sale',
            type: 'percent',
            value: 20,
            target: 'category',
            targetValue: cats.find(c => c.slug === 'outerwear').id,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            priority: 1,
            status: 'active'
        }
    ];

    discounts.forEach(d => REPO.createDiscount(d));

    // Banners
    const banners = [
        {
            title: 'Весенняя коллекция',
            subtitle: 'Новые поступления уже в магазине',
            ctaText: 'Смотреть коллекцию',
            ctaLink: '/catalog.html',
            placement: 'home_hero',
            theme: 'light',
            startDate: new Date().toISOString(),
            endDate: null,
            status: 'active',
            order: 1
        },
        {
            title: 'Скидки до 30%',
            subtitle: 'На верхнюю одежду',
            ctaText: 'В каталог',
            ctaLink: '/catalog.html?category=outerwear',
            placement: 'home_strip',
            theme: 'accent',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            order: 2
        }
    ];

    banners.forEach(b => REPO.createBanner(b));

    // Orders with automatic customer creation
    const products = REPO.getProducts();
    const orderStatuses = ['pending', 'processing', 'completed', 'cancelled'];

    // Sample customer data for orders
    const customerData = [
        { phone: '+7 (999) 123-45-67', name: 'Анна Смирнова', email: 'anna@example.com' },
        { phone: '+7 (999) 234-56-78', name: 'Дмитрий Иванов', email: 'dmitry@example.com' },
        { phone: '+7 (999) 345-67-89', name: 'Елена Петрова', email: 'elena@example.com' },
        { phone: '+7 (999) 456-78-90', name: 'Михаил Козлов', email: 'mikhail@example.com' },
        { phone: '+7 (999) 567-89-01', name: 'Ольга Новикова', email: 'olga@example.com' }
    ];

    for (let i = 0; i < 15; i++) {
        const customerInfo = customerData[Math.floor(Math.random() * customerData.length)];
        const numItems = Math.floor(Math.random() * 3) + 1;
        const items = [];
        let subtotal = 0;

        for (let j = 0; j < numItems; j++) {
            const product = products[Math.floor(Math.random() * products.length)];
            const quantity = Math.floor(Math.random() * 2) + 1;
            const price = product.price;

            items.push({
                productId: product.id,
                title: product.title,
                sku: product.sku,
                price: price,
                quantity: quantity,
                size: product.sizes?.[0] || 'M',
                color: product.colors?.[0] || 'Black'
            });

            subtotal += price * quantity;
        }

        const shipping = subtotal >= 5000 ? 0 : 500;
        const discount = 0;
        const total = subtotal + shipping - discount;
        const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];

        // Create order with customer phone - customer will be auto-created/updated
        REPO.createOrder({
            customerPhone: customerInfo.phone,
            customerName: customerInfo.name,
            customerEmail: customerInfo.email,
            items,
            subtotal,
            shipping,
            discount,
            total,
            status,
            shippingAddress: {
                address: 'ул. Примерная, д. 10, кв. 5',
                city: 'Москва',
                postalCode: '123456'
            },
            paymentMethod: 'card',
            notes: ''
        });
    }

    // Homepage Sections
    const sections = [
        { id: 'hero', name: 'Hero Banner', enabled: true, order: 1, config: { bannerId: REPO.getBanners()[0].id } },
        { id: 'promo', name: 'Promo Strip', enabled: true, order: 2, config: { text: 'Бесплатная доставка от 5000₽' } },
        { id: 'new', name: 'New Arrivals', enabled: true, order: 3, config: { source: 'tag', value: 'New', limit: 8 } },
        { id: 'sale', name: 'Sale', enabled: true, order: 4, config: { source: 'tag', value: 'Sale', limit: 4 } },
        { id: 'essentials', name: 'Essentials', enabled: true, order: 5, config: { source: 'manual', productIds: products.slice(0, 4).map(p => p.id) } },
        { id: 'newsletter', name: 'Newsletter', enabled: true, order: 6, config: {} }
    ];

    REPO.updateHomepageSections(sections);

    // Settings
    const settings = {
        storeName: 'AURA',
        storeDescription: 'Минималистичный магазин одежды премиум-класса',
        logoText: 'AURA',
        contactEmail: 'info@aura-store.com',
        contactPhone: '+7 999 999 9999',
        currency: 'RUB',
        currencySymbol: '₽',
        freeShippingThreshold: 5000,
        flatShippingRate: 500,
        enableTaxes: false,
        taxPercent: 0,
        returnPolicy: 'Возврат товара в течение 14 дней с момента получения.',
        privacyPolicy: 'Мы не передаем ваши данные третьим лицам.'
    };

    REPO.updateSettings(settings);

    // Users
    const users = [
        {
            name: 'Администратор',
            email: 'admin@aura.com',
            role: 'admin',
            status: 'active',
            permissions: {
                products: true,
                orders: true,
                customers: true,
                content: true,
                settings: true,
                users: true
            }
        },
        {
            name: 'Менеджер',
            email: 'manager@aura.com',
            role: 'manager',
            status: 'active',
            permissions: {
                products: true,
                orders: true,
                customers: true,
                content: false,
                settings: false,
                users: false
            }
        },
        {
            name: 'Контент-менеджер',
            email: 'content@aura.com',
            role: 'editor',
            status: 'active',
            permissions: {
                products: true,
                orders: false,
                customers: false,
                content: true,
                settings: false,
                users: false
            }
        }
    ];

    users.forEach(u => REPO.createUser(u));

    // Set current user
    REPO.setCurrentUser(users[0]);

    // Mark as initialized
    REPO.setInitialized();

    console.log('Admin initialized successfully!');
}

// Auto-run on load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        if (!REPO.isInitialized()) {
            seedData();
        }
    });
}
