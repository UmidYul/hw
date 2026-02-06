// Utility Functions

// Settings cache
let siteSettings = {
    currencySymbol: 'Сумм',
    currency: 'UZS',
    freeShippingThreshold: 0,
    shippingCost: 0
};

const normalizeCurrencySymbol = (symbol) => {
    if (!symbol) return 'Сумм';
    const value = String(symbol).trim();
    const lower = value.toLowerCase();
    if (lower.includes('руб') || lower.includes('rub') || value.includes('₽') || value === 'RUB') {
        return 'Сумм';
    }
    return value;
};

// Load settings from API
async function loadSiteSettings() {
    try {
        if (typeof API !== 'undefined' && API.settings) {
            const settings = await API.settings.get();
            siteSettings.currencySymbol = normalizeCurrencySymbol(settings.currency_symbol || 'Сумм');
            siteSettings.currency = settings.currency || 'UZS';
            siteSettings.freeShippingThreshold = Number(settings.free_shipping_threshold) || 0;
            siteSettings.shippingCost = Number(settings.shipping_cost) || 0;
        }
    } catch (error) {
        console.log('Using default settings');
    }
}

// Initialize settings on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSiteSettings);
} else {
    loadSiteSettings();
}

// Format price with currency
function formatPrice(price) {
    const symbol = normalizeCurrencySymbol(siteSettings.currencySymbol);
    return price.toLocaleString('ru-RU') + ' ' + symbol;
}

// LocalStorage helpers
const storage = {
    get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Error writing to localStorage:', e);
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Error removing from localStorage:', e);
        }
    }
};

// Cart operations
const cart = {
    getItems() {
        return storage.get('cart') || [];
    },

    setItems(items) {
        storage.set('cart', items);
        updateCartBadge();
        updateCartDrawer();
    },

    addItem(product, quantity = 1, size = null, color = null, variantId = null) {
        const items = this.getItems();

        // Create unique key based on product id, size, and color
        const key = `${product.id}-${size || 'default'}-${color || 'default'}`;

        const existingItem = items.find(item =>
            item.id === product.id &&
            item.size === size &&
            item.color === color
        );

        if (existingItem) {
            existingItem.quantity += quantity;
            if (variantId) {
                existingItem.variantId = variantId;
            }
        } else {
            items.push({
                id: product.id,
                title: product.title,
                price: product.price,
                oldPrice: product.oldPrice,
                image: product.images[0],
                quantity,
                size,
                color,
                key,
                variantId
            });
        }

        this.setItems(items);
        return true;
    },

    removeItem(key) {
        const items = this.getItems();
        const filtered = items.filter(item => item.key !== key);
        this.setItems(filtered);
    },

    updateQuantity(key, quantity, maxQuantity = 10) {
        const items = this.getItems();
        const item = items.find(item => item.key === key);
        if (item) {
            const limit = Number.isFinite(maxQuantity) ? maxQuantity : 10;
            const effectiveMax = Math.max(1, limit);
            item.quantity = Math.max(1, Math.min(effectiveMax, quantity));
            this.setItems(items);
        }
    },

    updateItem(key, updates) {
        const items = this.getItems();
        const index = items.findIndex(item => item.key === key);

        if (index !== -1) {
            // If size or color changed, create new key
            if (updates.size || updates.color) {
                const item = items[index];
                const newKey = `${item.id}-${updates.size || item.size}-${updates.color || item.color}`;
                const newVariantId = updates.variantId !== undefined ? updates.variantId : item.variantId;

                // Check if item with new key already exists
                const existingIndex = items.findIndex(i => i.key === newKey);

                if (existingIndex !== -1 && existingIndex !== index) {
                    // Merge quantities
                    items[existingIndex].quantity += item.quantity;
                    items.splice(index, 1);
                } else {
                    // Update item
                    items[index] = { ...item, ...updates, key: newKey, variantId: newVariantId };
                }
            } else {
                items[index] = { ...items[index], ...updates };
            }

            this.setItems(items);
        }
    },

    clear() {
        this.setItems([]);
    },

    getTotal() {
        const items = this.getItems();
        return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    },

    getCount() {
        const items = this.getItems();
        return items.reduce((sum, item) => sum + item.quantity, 0);
    }
};

// Wishlist operations
const wishlist = {
    getItems() {
        return storage.get('wishlist') || [];
    },

    setItems(items) {
        storage.set('wishlist', items);
        updateWishlistBadge();
        updateWishlistDrawer();
    },

    addItem(productId) {
        const items = this.getItems();
        if (!items.includes(productId)) {
            items.push(productId);
            this.setItems(items);
            return true;
        }
        return false;
    },

    removeItem(productId) {
        const items = this.getItems();
        const filtered = items.filter(id => id !== productId);
        this.setItems(filtered);
    },

    toggleItem(productId) {
        const items = this.getItems();
        if (items.includes(productId)) {
            this.removeItem(productId);
            return false;
        } else {
            this.addItem(productId);
            return true;
        }
    },

    hasItem(productId) {
        return this.getItems().includes(productId);
    }
};

// Promo code operations
// Legacy promo object (deprecated, use PromoManager instead)
const promoLegacy = {
    getApplied() {
        return storage.get('appliedPromo');
    },

    apply(code) {
        const promoData = promoCodes[code.toUpperCase()];
        if (promoData) {
            storage.set('appliedPromo', { code: code.toUpperCase(), ...promoData });
            return { success: true, data: promoData };
        }
        return { success: false, message: 'Промокод не найден' };
    },

    remove() {
        storage.remove('appliedPromo');
    },

    calculate(subtotal, items = []) {
        const applied = this.getApplied();
        if (!applied) return 0;

        // Check minimum amount
        if (subtotal < applied.minAmount) {
            return 0;
        }

        // Calculate discount
        let discountBase = subtotal;

        // Exclude sale items if required
        if (applied.excludeSale && items.length > 0) {
            discountBase = items.reduce((sum, item) => {
                if (!item.oldPrice) {
                    return sum + (item.price * item.quantity);
                }
                return sum;
            }, 0);
        }

        if (applied.type === 'percent') {
            return Math.round(discountBase * applied.value / 100);
        } else if (applied.type === 'fixed') {
            return Math.min(applied.value, discountBase);
        }

        return 0;
    }
};

// Recently viewed products
const recentlyViewed = {
    add(productId) {
        let items = storage.get('recentlyViewed') || [];
        items = items.filter(id => id !== productId);
        items.unshift(productId);
        items = items.slice(0, 6);
        storage.set('recentlyViewed', items);
    },

    get() {
        return storage.get('recentlyViewed') || [];
    }
};

// Toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success' ? 'fa-check-circle' :
        type === 'error' ? 'fa-exclamation-circle' :
            'fa-info-circle';

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Render product card
function renderProductCard(product) {
    const isInWishlist = wishlist.hasItem(product.id);

    // Check for discount from discount system or old format
    const finalPrice = product.finalPrice ?? product.price;
    const originalPrice = product.appliedDiscount ? product.price : (product.oldPrice || product.old_price);
    const discountPercent = product.discountPercent ||
        (product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0);
    const hasDiscount = discountPercent > 0;

    // Check if product is out of stock
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const stockCount = variants.length > 0
        ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : (product.stock || 0);
    const isOutOfStock = stockCount === 0;

    // Get first image
    const imageUrl = product.images ? product.images[0] : product.image;

    return `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-card-image" data-link="/product?id=${product.id}" role="link" style="background-image: url('${imageUrl}'); background-size: cover; background-position: center;">
                <div class="product-card-actions">
                    <button class="product-card-btn wishlist-toggle" data-id="${product.id}" aria-label="В избранное">
                        <i class="fa${isInWishlist ? 's' : 'r'} fa-heart"></i>
                    </button>
                    <button class="product-card-btn quick-view" data-id="${product.id}" aria-label="Быстрый просмотр">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
                ${(product.tags && product.tags.length > 0) || hasDiscount || isOutOfStock ? `
                    <div class="product-card-badges">
                        ${hasDiscount ? `<span class="badge-sale">-${discountPercent}%</span>` : ''}
                        ${isOutOfStock ? `<span class="badge-limited">Распродано</span>` : ''}
                        ${product.tags ? product.tags.map(tag => {
        if (tag === 'New') {
            return `<span class="badge-new">New</span>`;
        } else if (tag === 'Limited') {
            return `<span class="badge-limited">Limited</span>`;
        }
        return '';
    }).join('') : ''}
                    </div>
                ` : ''}
            </div>
            <div class="product-card-body">
                <a href="/product?id=${product.id}" class="product-card-title">${product.title || product.name}</a>
                <div class="product-card-rating">
                    <div class="rating-stars">
                        ${generateStars(product.rating || 0)}
                    </div>
                    <span class="rating-count">(${product.reviewsCount || product.reviews_count || 0})</span>
                </div>
                <div class="product-card-price">
                    <span class="price-current">${formatPrice(finalPrice)}</span>
                    ${originalPrice && originalPrice > finalPrice ? `<span class="price-old">${formatPrice(originalPrice)}</span>` : ''}
                </div>
                <button class="btn btn-outline btn-sm btn-block add-to-cart-quick" data-id="${product.id}" ${isOutOfStock ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                    ${isOutOfStock ? 'Нет в наличии' : 'В корзину'}
                </button>
            </div>
        </div>
    `;
}

// Adjust color brightness
function adjustColor(color, amount) {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}

// Generate star rating HTML
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let html = '';

    for (let i = 0; i < fullStars; i++) {
        html += '<i class="fas fa-star"></i>';
    }

    if (hasHalfStar) {
        html += '<i class="fas fa-star-half-alt"></i>';
    }

    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
        html += '<i class="far fa-star"></i>';
    }

    return html;
}

// Render products to container
function renderProducts(products, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = products.map(product => renderProductCard(product)).join('');

    // Attach event listeners
    attachProductCardListeners(container);
}

// Attach event listeners to product cards
function attachProductCardListeners(container) {
    // Image click -> product page
    container.querySelectorAll('.product-card-image').forEach(image => {
        image.addEventListener('click', () => {
            const link = image.getAttribute('data-link');
            if (link) {
                window.location.href = link;
            }
        });
    });

    // Wishlist toggles
    container.querySelectorAll('.wishlist-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const productId = parseInt(btn.dataset.id);
            const added = wishlist.toggleItem(productId);

            const icon = btn.querySelector('i');
            icon.className = added ? 'fas fa-heart' : 'far fa-heart';

            showToast(added ? 'Добавлено в избранное' : 'Удалено из избранного', 'success');
        });
    });

    // Quick view
    container.querySelectorAll('.quick-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const productId = parseInt(btn.dataset.id);
            openQuickView(productId);
        });
    });

    // Quick add to cart
    container.querySelectorAll('.add-to-cart-quick').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const productId = parseInt(btn.dataset.id);
            const product = products.find(p => p.id === productId);

            if (product) {
                const productVariants = Array.isArray(product.variants) ? product.variants : [];
                if (productVariants.length > 0) {
                    const availableVariant = productVariants.find(v => (v.stock || 0) > 0);
                    if (!availableVariant) {
                        showToast('Нет в наличии', 'error');
                        return;
                    }
                    cart.addItem(product, 1, availableVariant.size, availableVariant.color, availableVariant.id);
                } else {
                    const defaultSize = product.sizes[0];
                    const defaultColor = product.colors[0];
                    cart.addItem(product, 1, defaultSize, defaultColor);
                }
                showToast('Товар добавлен в корзину', 'success');
            }
        });
    });
}

// Update badge counters
function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (badge) {
        const count = cart.getCount();
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function updateWishlistBadge() {
    const badge = document.getElementById('wishlistBadge');
    if (badge) {
        const count = wishlist.getItems().length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// Simulate loading delay
function simulateLoading(callback, delay = 800) {
    setTimeout(callback, delay);
}

// Get URL parameter
function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
