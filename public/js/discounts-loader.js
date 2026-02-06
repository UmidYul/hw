// Discount system loader
class DiscountSystem {
    constructor() {
        this.activeDiscounts = [];
        this.loaded = false;
    }

    // Load active discounts from API
    async loadActiveDiscounts() {
        if (this.loaded) return this.activeDiscounts;

        try {
            const response = await fetch('/api/discounts/active');
            if (!response.ok) throw new Error('Failed to load discounts');

            this.activeDiscounts = await response.json();
            this.loaded = true;
            return this.activeDiscounts;
        } catch (error) {
            console.error('Error loading active discounts:', error);
            this.activeDiscounts = [];
            this.loaded = true;
            return [];
        }
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
            // Collection check would require additional data
            const collectionId = discount.collection_id;
            return false; // TODO: Implement collection check
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
