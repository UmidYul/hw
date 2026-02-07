// ========================================
// Higher Waist Admin Panel - Repository Layer
// Data Management with LocalStorage
// ========================================

const REPO = {
    // Storage keys
    KEYS: {
        PRODUCTS: 'admin_products',
        CATEGORIES: 'admin_categories',
        COLLECTIONS: 'admin_collections',
        DISCOUNTS: 'admin_discounts',
        PROMO_CODES: 'admin_promo_codes',
        BANNERS: 'admin_banners',
        ORDERS: 'admin_orders',
        CUSTOMERS: 'admin_customers',
        HOMEPAGE_SECTIONS: 'admin_homepage_sections',
        SETTINGS: 'admin_settings',
        USERS: 'admin_users',
        AUDIT_LOG: 'admin_audit_log',
        CURRENT_USER: 'admin_current_user',
        INITIALIZED: 'admin_initialized'
    },

    // Generic helpers
    _get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error(`Error reading ${key}:`, e);
            return null;
        }
    },

    _set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Error writing ${key}:`, e);
            return false;
        }
    },

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Products
    getProducts() {
        return this._get(this.KEYS.PRODUCTS) || [];
    },

    getProduct(id) {
        const products = this.getProducts();
        return products.find(p => p.id === id);
    },

    createProduct(data) {
        const products = this.getProducts();
        const product = {
            ...data,
            id: this._generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        products.push(product);
        this._set(this.KEYS.PRODUCTS, products);
        this.addAuditLog('product', 'create', `Created product: ${product.title}`);
        return product;
    },

    updateProduct(id, data) {
        const products = this.getProducts();
        const index = products.findIndex(p => p.id === id);
        if (index !== -1) {
            products[index] = {
                ...products[index],
                ...data,
                updatedAt: new Date().toISOString()
            };
            this._set(this.KEYS.PRODUCTS, products);
            this.addAuditLog('product', 'update', `Updated product: ${products[index].title}`);
            return products[index];
        }
        return null;
    },

    deleteProduct(id) {
        const products = this.getProducts();
        const product = products.find(p => p.id === id);
        const filtered = products.filter(p => p.id !== id);
        this._set(this.KEYS.PRODUCTS, filtered);
        if (product) {
            this.addAuditLog('product', 'delete', `Deleted product: ${product.title}`);
        }
        return true;
    },

    bulkUpdateProducts(ids, updates) {
        const products = this.getProducts();
        ids.forEach(id => {
            const index = products.findIndex(p => p.id === id);
            if (index !== -1) {
                products[index] = {
                    ...products[index],
                    ...updates,
                    updatedAt: new Date().toISOString()
                };
            }
        });
        this._set(this.KEYS.PRODUCTS, products);
        this.addAuditLog('product', 'bulk_update', `Bulk updated ${ids.length} products`);
        return true;
    },

    // Categories
    getCategories() {
        return this._get(this.KEYS.CATEGORIES) || [];
    },

    getCategory(id) {
        const categories = this.getCategories();
        return categories.find(c => c.id === id);
    },

    createCategory(data) {
        const categories = this.getCategories();
        const category = {
            ...data,
            id: this._generateId(),
            createdAt: new Date().toISOString()
        };
        categories.push(category);
        this._set(this.KEYS.CATEGORIES, categories);
        this.addAuditLog('category', 'create', `Created category: ${category.name}`);
        return category;
    },

    updateCategory(id, data) {
        const categories = this.getCategories();
        const index = categories.findIndex(c => c.id === id);
        if (index !== -1) {
            categories[index] = { ...categories[index], ...data };
            this._set(this.KEYS.CATEGORIES, categories);
            this.addAuditLog('category', 'update', `Updated category: ${categories[index].name}`);
            return categories[index];
        }
        return null;
    },

    deleteCategory(id) {
        const categories = this.getCategories();
        const category = categories.find(c => c.id === id);

        // Check if any products use this category
        const products = this.getProducts();
        const hasProducts = products.some(p => p.category === id);

        if (hasProducts) {
            return { error: 'Cannot delete category with products' };
        }

        const filtered = categories.filter(c => c.id !== id);
        this._set(this.KEYS.CATEGORIES, filtered);
        if (category) {
            this.addAuditLog('category', 'delete', `Deleted category: ${category.name}`);
        }
        return true;
    },

    // Collections
    getCollections() {
        return this._get(this.KEYS.COLLECTIONS) || [];
    },

    getCollection(id) {
        const collections = this.getCollections();
        return collections.find(c => c.id === id);
    },

    createCollection(data) {
        const collections = this.getCollections();
        const collection = {
            ...data,
            id: this._generateId(),
            createdAt: new Date().toISOString()
        };
        collections.push(collection);
        this._set(this.KEYS.COLLECTIONS, collections);
        this.addAuditLog('collection', 'create', `Created collection: ${collection.name}`);
        return collection;
    },

    updateCollection(id, data) {
        const collections = this.getCollections();
        const index = collections.findIndex(c => c.id === id);
        if (index !== -1) {
            collections[index] = { ...collections[index], ...data };
            this._set(this.KEYS.COLLECTIONS, collections);
            this.addAuditLog('collection', 'update', `Updated collection: ${collections[index].name}`);
            return collections[index];
        }
        return null;
    },

    deleteCollection(id) {
        const collections = this.getCollections();
        const collection = collections.find(c => c.id === id);
        const filtered = collections.filter(c => c.id !== id);
        this._set(this.KEYS.COLLECTIONS, filtered);
        if (collection) {
            this.addAuditLog('collection', 'delete', `Deleted collection: ${collection.name}`);
        }
        return true;
    },

    getCollectionProducts(collectionId) {
        const collection = this.getCollection(collectionId);
        if (!collection) return [];

        const products = this.getProducts();

        if (collection.ruleType === 'manual') {
            return products.filter(p => collection.productIds?.includes(p.id));
        } else {
            // Rule-based filtering
            return products.filter(p => {
                const rule = collection.rule;
                if (rule.tag) return p.tags?.includes(rule.tag);
                if (rule.category) return p.category === rule.category;
                if (rule.priceMax) return p.price <= rule.priceMax;
                return true;
            });
        }
    },

    // Discounts
    getDiscounts() {
        return this._get(this.KEYS.DISCOUNTS) || [];
    },

    getDiscount(id) {
        const discounts = this.getDiscounts();
        return discounts.find(d => d.id === id);
    },

    createDiscount(data) {
        const discounts = this.getDiscounts();
        const discount = {
            ...data,
            id: this._generateId(),
            createdAt: new Date().toISOString()
        };
        discounts.push(discount);
        this._set(this.KEYS.DISCOUNTS, discounts);
        this.addAuditLog('discount', 'create', `Created discount: ${discount.name}`);
        return discount;
    },

    updateDiscount(id, data) {
        const discounts = this.getDiscounts();
        const index = discounts.findIndex(d => d.id === id);
        if (index !== -1) {
            discounts[index] = { ...discounts[index], ...data };
            this._set(this.KEYS.DISCOUNTS, discounts);
            this.addAuditLog('discount', 'update', `Updated discount: ${discounts[index].name}`);
            return discounts[index];
        }
        return null;
    },

    deleteDiscount(id) {
        const discounts = this.getDiscounts();
        const discount = discounts.find(d => d.id === id);
        const filtered = discounts.filter(d => d.id !== id);
        this._set(this.KEYS.DISCOUNTS, filtered);
        if (discount) {
            this.addAuditLog('discount', 'delete', `Deleted discount: ${discount.name}`);
        }
        return true;
    },

    // Promo Codes
    getPromoCodes() {
        return this._get(this.KEYS.PROMO_CODES) || [];
    },

    getPromoCode(id) {
        const promoCodes = this.getPromoCodes();
        return promoCodes.find(p => p.id === id);
    },

    getPromoCodeByCode(code) {
        const promoCodes = this.getPromoCodes();
        return promoCodes.find(p => p.code.toUpperCase() === code.toUpperCase());
    },

    createPromoCode(data) {
        const promoCodes = this.getPromoCodes();
        const promoCode = {
            ...data,
            id: this._generateId(),
            code: data.code.toUpperCase(),
            createdAt: new Date().toISOString(),
            usedCount: 0
        };
        promoCodes.push(promoCode);
        this._set(this.KEYS.PROMO_CODES, promoCodes);
        this.addAuditLog('promo_code', 'create', `Created promo code: ${promoCode.code}`);
        return promoCode;
    },

    updatePromoCode(id, data) {
        const promoCodes = this.getPromoCodes();
        const index = promoCodes.findIndex(p => p.id === id);
        if (index !== -1) {
            promoCodes[index] = { ...promoCodes[index], ...data };
            this._set(this.KEYS.PROMO_CODES, promoCodes);
            this.addAuditLog('promo_code', 'update', `Updated promo code: ${promoCodes[index].code}`);
            return promoCodes[index];
        }
        return null;
    },

    deletePromoCode(id) {
        const promoCodes = this.getPromoCodes();
        const promoCode = promoCodes.find(p => p.id === id);
        const filtered = promoCodes.filter(p => p.id !== id);
        this._set(this.KEYS.PROMO_CODES, filtered);
        if (promoCode) {
            this.addAuditLog('promo_code', 'delete', `Deleted promo code: ${promoCode.code}`);
        }
        return true;
    },

    generatePromoCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    // Banners
    getBanners() {
        return this._get(this.KEYS.BANNERS) || [];
    },

    getBanner(id) {
        const banners = this.getBanners();
        return banners.find(b => b.id === id);
    },

    createBanner(data) {
        const banners = this.getBanners();
        const banner = {
            ...data,
            id: this._generateId(),
            createdAt: new Date().toISOString()
        };
        banners.push(banner);
        this._set(this.KEYS.BANNERS, banners);
        this.addAuditLog('banner', 'create', `Created banner: ${banner.title}`);
        return banner;
    },

    updateBanner(id, data) {
        const banners = this.getBanners();
        const index = banners.findIndex(b => b.id === id);
        if (index !== -1) {
            banners[index] = { ...banners[index], ...data };
            this._set(this.KEYS.BANNERS, banners);
            this.addAuditLog('banner', 'update', `Updated banner: ${banners[index].title}`);
            return banners[index];
        }
        return null;
    },

    deleteBanner(id) {
        const banners = this.getBanners();
        const banner = banners.find(b => b.id === id);
        const filtered = banners.filter(b => b.id !== id);
        this._set(this.KEYS.BANNERS, filtered);
        if (banner) {
            this.addAuditLog('banner', 'delete', `Deleted banner: ${banner.title}`);
        }
        return true;
    },

    // Orders
    getOrders() {
        return this._get(this.KEYS.ORDERS) || [];
    },

    getOrder(id) {
        const orders = this.getOrders();
        return orders.find(o => o.id === id);
    },

    createOrder(data) {
        const orders = this.getOrders();

        // Auto-create or update customer if phone provided
        let customerId = data.customerId;
        if (data.customerPhone) {
            const customer = this.findOrCreateCustomerByPhone(
                data.customerPhone,
                {
                    name: data.customerName,
                    email: data.customerEmail
                }
            );
            customerId = customer.id;
        }

        const order = {
            ...data,
            customerId,
            id: this._generateId(),
            orderNumber: data.orderNumber || `ORD-${Date.now().toString().slice(-6)}`,
            createdAt: new Date().toISOString(),
            statusHistory: [{
                status: data.status || 'pending',
                timestamp: new Date().toISOString(),
                note: 'Order created'
            }]
        };
        orders.push(order);
        this._set(this.KEYS.ORDERS, orders);
        this.addAuditLog('order', 'create', `Created order: ${order.orderNumber}`);
        return order;
    },

    updateOrder(id, data) {
        const orders = this.getOrders();
        const index = orders.findIndex(o => o.id === id);
        if (index !== -1) {
            const oldStatus = orders[index].status;
            orders[index] = { ...orders[index], ...data };

            // Add to status history if status changed
            if (data.status && data.status !== oldStatus) {
                if (!orders[index].statusHistory) orders[index].statusHistory = [];
                orders[index].statusHistory.push({
                    status: data.status,
                    timestamp: new Date().toISOString(),
                    note: data.statusNote || ''
                });
            }

            this._set(this.KEYS.ORDERS, orders);
            this.addAuditLog('order', 'update', `Updated order: ${orders[index].number}`);
            return orders[index];
        }
        return null;
    },

    deleteOrder(id) {
        const orders = this.getOrders();
        const order = orders.find(o => o.id === id);
        const filtered = orders.filter(o => o.id !== id);
        this._set(this.KEYS.ORDERS, filtered);
        if (order) {
            this.addAuditLog('order', 'delete', `Deleted order: ${order.number}`);
        }
        return true;
    },

    // Customers
    getCustomers() {
        return this._get(this.KEYS.CUSTOMERS) || [];
    },

    getCustomer(id) {
        const customers = this.getCustomers();
        return customers.find(c => c.id === id);
    },

    getCustomerByPhone(phone) {
        const customers = this.getCustomers();
        // Normalize phone for comparison
        const normalizedPhone = phone.replace(/\D/g, '');
        return customers.find(c => c.phone?.replace(/\D/g, '') === normalizedPhone);
    },

    findOrCreateCustomerByPhone(phone, additionalData = {}) {
        // Try to find existing customer by phone
        let customer = this.getCustomerByPhone(phone);

        if (customer) {
            // Update customer data if new information provided
            if (additionalData.name || additionalData.email) {
                const updateData = {};
                if (additionalData.name && !customer.name) updateData.name = additionalData.name;
                if (additionalData.email && !customer.email) updateData.email = additionalData.email;
                if (Object.keys(updateData).length > 0) {
                    customer = this.updateCustomer(customer.id, updateData);
                }
            }
            return customer;
        }

        // Create new customer
        return this.createCustomer({
            phone,
            ...additionalData
        });
    },

    createCustomer(data) {
        const customers = this.getCustomers();
        const customer = {
            ...data,
            id: this._generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        customers.push(customer);
        this._set(this.KEYS.CUSTOMERS, customers);
        this.addAuditLog('customer', 'create', `Created customer: ${customer.phone}`);
        return customer;
    },

    updateCustomer(id, data) {
        const customers = this.getCustomers();
        const index = customers.findIndex(c => c.id === id);
        if (index !== -1) {
            customers[index] = {
                ...customers[index],
                ...data,
                updatedAt: new Date().toISOString()
            };
            this._set(this.KEYS.CUSTOMERS, customers);
            this.addAuditLog('customer', 'update', `Updated customer: ${customers[index].phone}`);
            return customers[index];
        }
        return null;
    },

    deleteCustomer(id) {
        const customers = this.getCustomers();
        const customer = customers.find(c => c.id === id);
        const filtered = customers.filter(c => c.id !== id);
        this._set(this.KEYS.CUSTOMERS, filtered);
        if (customer) {
            this.addAuditLog('customer', 'delete', `Deleted customer: ${customer.phone}`);
        }
        return true;
    },

    // Homepage Sections
    getHomepageSections() {
        return this._get(this.KEYS.HOMEPAGE_SECTIONS) || [];
    },

    updateHomepageSections(sections) {
        this._set(this.KEYS.HOMEPAGE_SECTIONS, sections);
        this.addAuditLog('content', 'update', 'Updated homepage sections');
        return sections;
    },

    // Settings
    getSettings() {
        return this._get(this.KEYS.SETTINGS) || {};
    },

    updateSettings(data) {
        const settings = this.getSettings();
        const updated = { ...settings, ...data };
        this._set(this.KEYS.SETTINGS, updated);
        this.addAuditLog('settings', 'update', 'Updated store settings');
        return updated;
    },

    // Users
    getUsers() {
        return this._get(this.KEYS.USERS) || [];
    },

    getUser(id) {
        const users = this.getUsers();
        return users.find(u => u.id === id);
    },

    getCurrentUser() {
        return this._get(this.KEYS.CURRENT_USER);
    },

    setCurrentUser(user) {
        this._set(this.KEYS.CURRENT_USER, user);
    },

    createUser(data) {
        const users = this.getUsers();
        const user = {
            ...data,
            id: this._generateId(),
            createdAt: new Date().toISOString()
        };
        users.push(user);
        this._set(this.KEYS.USERS, users);
        this.addAuditLog('user', 'create', `Created user: ${user.name}`);
        return user;
    },

    updateUser(id, data) {
        const users = this.getUsers();
        const index = users.findIndex(u => u.id === id);
        if (index !== -1) {
            users[index] = { ...users[index], ...data };
            this._set(this.KEYS.USERS, users);
            this.addAuditLog('user', 'update', `Updated user: ${users[index].name}`);
            return users[index];
        }
        return null;
    },

    // Audit Log
    getAuditLog() {
        return this._get(this.KEYS.AUDIT_LOG) || [];
    },

    addAuditLog(entity, action, summary) {
        const logs = this.getAuditLog();
        const currentUser = this.getCurrentUser();

        const log = {
            id: this._generateId(),
            entity,
            action,
            summary,
            user: currentUser?.name || 'Admin',
            timestamp: new Date().toISOString()
        };

        logs.unshift(log);

        // Keep only last 200 entries
        if (logs.length > 200) {
            logs.splice(200);
        }

        this._set(this.KEYS.AUDIT_LOG, logs);
    },

    // Export/Import
    exportData() {
        const data = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            products: this.getProducts(),
            categories: this.getCategories(),
            collections: this.getCollections(),
            discounts: this.getDiscounts(),
            promoCodes: this.getPromoCodes(),
            banners: this.getBanners(),
            orders: this.getOrders(),
            customers: this.getCustomers(),
            homepageSections: this.getHomepageSections(),
            settings: this.getSettings()
        };
        return data;
    },

    importData(data) {
        if (!data.version || data.version !== '1.0') {
            throw new Error('Invalid data format');
        }

        if (data.products) this._set(this.KEYS.PRODUCTS, data.products);
        if (data.categories) this._set(this.KEYS.CATEGORIES, data.categories);
        if (data.collections) this._set(this.KEYS.COLLECTIONS, data.collections);
        if (data.discounts) this._set(this.KEYS.DISCOUNTS, data.discounts);
        if (data.promoCodes) this._set(this.KEYS.PROMO_CODES, data.promoCodes);
        if (data.banners) this._set(this.KEYS.BANNERS, data.banners);
        if (data.orders) this._set(this.KEYS.ORDERS, data.orders);
        if (data.customers) this._set(this.KEYS.CUSTOMERS, data.customers);
        if (data.homepageSections) this._set(this.KEYS.HOMEPAGE_SECTIONS, data.homepageSections);
        if (data.settings) this._set(this.KEYS.SETTINGS, data.settings);

        this.addAuditLog('system', 'import', 'Imported backup data');
        return true;
    },

    // Initialization
    isInitialized() {
        return this._get(this.KEYS.INITIALIZED) === true;
    },

    setInitialized() {
        this._set(this.KEYS.INITIALIZED, true);
    },

    resetData() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }
};

// Make available globally
window.REPO = REPO;
