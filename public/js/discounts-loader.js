// Discount system loader
class DiscountSystem {
    constructor() {
        this.activeDiscounts = [];
        this.loaded = false;
        this.collections = [];
        this.collectionsLoaded = false;
        this.collectionProductMap = new Map();
    }

    // Load active discounts from API
    async loadActiveDiscounts() {
        if (this.loaded) return this.activeDiscounts;

        try {
            const response = await fetch('/api/discounts/active');
            if (!response.ok) throw new Error('Failed to load discounts');

            this.activeDiscounts = await response.json();
            if (this.activeDiscounts.some(discount => discount.target === 'collection')) {
                await this.loadCollections();
            }
            this.loaded = true;
            return this.activeDiscounts;
        } catch (error) {
            console.error('Error loading active discounts:', error);
            this.activeDiscounts = [];
            this.loaded = true;
            return [];
        }
    }

    async loadCollections() {
        if (this.collectionsLoaded) return this.collections;

        try {
            const response = await fetch('/api/collections');
            if (!response.ok) throw new Error('Failed to load collections');
            this.collections = await response.json();
        } catch (error) {
            console.error('Error loading collections:', error);
            this.collections = [];
        }

        this.collectionsLoaded = true;
        return this.collections;
    }

    // Apply discounts to a product
    applyDiscounts(product) {
        if (!this.loaded || this.activeDiscounts.length === 0) {
            return {
                ...product,
                finalPrice: product.price,
                appliedDiscount: null,
                discountAmount: 0
            };
        }

        // Find applicable discounts
        const applicableDiscounts = this.activeDiscounts
            .filter(discount => this.isDiscountApplicable(discount, product))
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        if (applicableDiscounts.length === 0) {
            return {
                ...product,
                finalPrice: product.price,
                appliedDiscount: null,
                discountAmount: 0
            };
        }

        // Apply highest priority discount
        const discount = applicableDiscounts[0];
        const discountAmount = this.calculateDiscountAmount(discount, product.price);
        const finalPrice = Math.max(0, product.price - discountAmount);

        return {
            ...product,
            finalPrice,
            appliedDiscount: discount,
            discountAmount,
            discountPercent: discount.discount_type === 'percent' ? discount.discount_value :
                Math.round((discountAmount / product.price) * 100)
        };
    }

    // Check if discount is applicable to product
    isDiscountApplicable(discount, product) {
        const target = discount.target;

        // Check target type
        if (target === 'all') {
            return true;
        }

        if (target === 'category') {
            const categoryId = discount.category_id;
            if (categoryId === null || categoryId === undefined) return false;
            const normalizedCategoryId = String(categoryId);
            const productCategory = product.category !== undefined ? String(product.category) : null;
            const productCategoryId = product.category_id !== undefined ? String(product.category_id) : null;

            return productCategory === normalizedCategoryId || productCategoryId === normalizedCategoryId;
        }

        if (target === 'collection') {
            const collectionId = discount.collection_id;
            if (!collectionId) return false;
            const productSet = this.collectionProductMap.get(String(collectionId));
            if (!productSet) return false;
            return productSet.has(String(product.id));
        }

        if (target === 'products') {
            let productIds = discount.product_ids;
            if (typeof productIds === 'string') {
                try {
                    productIds = JSON.parse(productIds);
                } catch (e) {
                    productIds = [];
                }
            }
            if (!Array.isArray(productIds)) return false;
            const normalizedIds = productIds.map(id => String(id));
            return normalizedIds.includes(String(product.id));
        }

        return false;
    }

    // Calculate discount amount
    calculateDiscountAmount(discount, price) {
        const discountType = discount.discount_type;
        const discountValue = discount.discount_value;

        if (discountType === 'percent') {
            return (price * discountValue) / 100;
        } else {
            return discountValue;
        }
    }

    // Apply discounts to multiple products
    applyDiscountsToProducts(products) {
        if (this.activeDiscounts.some(discount => discount.target === 'collection')) {
            this.buildCollectionProductMap(products);
        }
        return products.map(product => this.applyDiscounts(product));
    }

    // Get discount badge HTML
    getDiscountBadge(product) {
        if (!product.appliedDiscount || !product.discountPercent) {
            return '';
        }
        return `<span class="product-badge product-badge-sale">-${product.discountPercent}%</span>`;
    }

    // Get price HTML with discount
    getPriceHTML(product) {
        if (!product.appliedDiscount) {
            return `<span class="price-current">${this.formatPrice(product.price)}</span>`;
        }

        return `
            <span class="price-current">${this.formatPrice(product.finalPrice)}</span>
            <span class="price-old">${this.formatPrice(product.price)}</span>
        `;
    }

    // Format price
    formatPrice(price) {
        return price.toLocaleString('ru-RU') + ' Сумм';
    }

    parseJsonField(value, fallback) {
        if (value === null || value === undefined) return fallback;
        if (Array.isArray(value)) return value;
        if (typeof value === 'object') return value;
        try {
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    buildCollectionProductMap(products) {
        this.collectionProductMap = new Map();
        if (!Array.isArray(products) || !Array.isArray(this.collections)) return;

        const normalizedProducts = products.map(product => ({
            ...product,
            tags: this.parseJsonField(product.tags, [])
        }));

        this.collections.forEach(collection => {
            const collectionId = String(collection.id);
            const type = collection.type || collection.collection_type || 'manual';
            const conditions = this.parseJsonField(collection.conditions, null);
            const productIds = this.parseJsonField(collection.product_ids, []);

            if (type === 'manual') {
                const set = new Set((productIds || []).map(id => String(id)));
                this.collectionProductMap.set(collectionId, set);
                return;
            }

            if (!conditions) {
                this.collectionProductMap.set(collectionId, new Set());
                return;
            }

            const conditionTags = Array.isArray(conditions.tags) ? conditions.tags : [];
            const categoryValue = conditions.category || conditions.categoryId || '';
            const minPrice = Number(conditions.min_price ?? conditions.minPrice ?? 0);
            const maxPrice = Number(conditions.max_price ?? conditions.maxPrice ?? Infinity);
            const limit = Number(conditions.limit ?? 0);

            let matched = normalizedProducts.filter(product => {
                const productCategory = product.category || product.category_slug || product.category_id || product.categoryId;
                if (categoryValue && String(productCategory) !== String(categoryValue)) return false;
                const price = product.price || 0;
                if (price < minPrice || price > maxPrice) return false;
                if (conditionTags.length > 0) {
                    const productTags = Array.isArray(product.tags) ? product.tags.map(tag => String(tag)) : [];
                    const normalizedTags = productTags.map(tag => tag.toLowerCase());
                    const normalizedConditions = conditionTags.map(tag => String(tag).toLowerCase());
                    if (!normalizedConditions.some(tag => normalizedTags.includes(tag))) return false;
                }
                return true;
            });

            if (Number.isFinite(limit) && limit > 0) {
                matched = matched.slice(0, limit);
            }

            const set = new Set(matched.map(product => String(product.id)));
            this.collectionProductMap.set(collectionId, set);
        });
    }
}

// Create global instance
window.discountSystem = new DiscountSystem();

// Auto-load on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.discountSystem.loadActiveDiscounts();
    });
} else {
    window.discountSystem.loadActiveDiscounts();
}
