// Promo Code Manager with API validation and tracking

class PromoManager {
    constructor() {
        this.applied = null;
        this.loadFromStorage();
    }

    loadFromStorage() {
        const stored = localStorage.getItem('appliedPromo');
        if (stored) {
            try {
                this.applied = JSON.parse(stored);
            } catch (e) {
                this.applied = null;
            }
        }
    }

    saveToStorage() {
        if (this.applied) {
            localStorage.setItem('appliedPromo', JSON.stringify(this.applied));
        } else {
            localStorage.removeItem('appliedPromo');
        }
    }

    getApplied() {
        return this.applied;
    }

    // Apply promo code with API validation
    async apply(code, subtotal, customerIdentifier = null) {
        try {
            const data = await API.promocodes.validate(code.toUpperCase(), subtotal);

            if (data.valid) {
                this.applied = {
                    code: code.toUpperCase(),
                    type: data.type,
                    value: data.value,
                    discount: data.discount,
                    excludeSale: data.excludeSale
                };
                this.saveToStorage();
                return { success: true, message: 'Промокод применен', discount: data.discount };
            } else {
                return { success: false, message: data.message || 'Промокод недействителен' };
            }
        } catch (error) {
            console.error('Promo validation error:', error);
            return { success: false, message: 'Ошибка проверки промокода' };
        }
    }

    // Calculate discount for current cart
    calculate(subtotal, items) {
        if (!this.applied) return 0;

        let eligibleAmount = subtotal;

        // If promo excludes sale items, calculate only non-sale items
        if (this.applied.excludeSale && items) {
            eligibleAmount = items.reduce((sum, item) => {
                const isOnSale = item.oldPrice || item.old_price;
                return sum + (isOnSale ? 0 : item.price * item.quantity);
            }, 0);
        }

        let discount = 0;
        if (this.applied.type === 'percent') {
            discount = Math.round(eligibleAmount * this.applied.value / 100);
        } else {
            discount = Math.min(this.applied.value, eligibleAmount);
        }

        return discount;
    }

    // Record usage after order is placed
    async recordUsage(orderId, discountAmount, customerPhone) {
        if (!this.applied) return;

        try {
            await API.promocodes.recordUsage(this.applied.code, customerPhone, orderId);
        } catch (error) {
            console.error('Failed to record promo usage:', error);
        }
    }

    remove() {
        this.applied = null;
        this.saveToStorage();
    }
}

// Global promo instance
const promo = new PromoManager();
