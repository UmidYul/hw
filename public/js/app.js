// Main Application Logic
// This file handles common functionality across all pages

document.addEventListener('DOMContentLoaded', () => {
    // Initialize badges
    updateCartBadge();
    updateWishlistBadge();

    // Header interactions
    initializeHeader();

    // Drawers
    initializeCartDrawer();
    initializeWishlistDrawer();

    // Search modal
    initializeSearchModal();

    // Update drawers
    updateCartDrawer();
    updateWishlistDrawer();
});

// Header functionality
function initializeHeader() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mainNav = document.getElementById('mainNav');

    if (mobileMenuBtn && mainNav) {
        mobileMenuBtn.addEventListener('click', () => {
            mainNav.classList.toggle('nav-open');
            mobileMenuBtn.classList.toggle('active');
        });
    }
}

// Cart Drawer
function initializeCartDrawer() {
    const cartBtn = document.getElementById('cartBtn');
    const cartDrawer = document.getElementById('cartDrawer');
    const cartDrawerOverlay = document.getElementById('cartDrawerOverlay');
    const cartDrawerClose = document.getElementById('cartDrawerClose');

    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            cartDrawer.classList.add('open');
            document.body.style.overflow = 'hidden';
        });
    }

    const closeDrawer = () => {
        cartDrawer.classList.remove('open');
        document.body.style.overflow = '';
    };

    if (cartDrawerOverlay) cartDrawerOverlay.addEventListener('click', closeDrawer);
    if (cartDrawerClose) cartDrawerClose.addEventListener('click', closeDrawer);
}

function updateCartDrawer() {
    const items = cart.getItems();
    const drawerBody = document.getElementById('drawerCartItems');
    const drawerFooter = document.getElementById('drawerFooter');
    const drawerCount = document.getElementById('drawerCartCount');
    const drawerTotal = document.getElementById('drawerTotal');

    if (!drawerBody) return;

    drawerCount.textContent = cart.getCount();

    if (items.length === 0) {
        drawerBody.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-bag empty-icon"></i>
                <p>Корзина пуста</p>
            </div>
        `;
        drawerFooter.style.display = 'none';
    } else {
        drawerBody.innerHTML = items.map(item => `
            <div class="drawer-item">
                <div class="drawer-item-image" style="background-image: url('${item.image || item.images?.[0] || ''}'); background-size: cover; background-position: center;"></div>
                <div class="drawer-item-info">
                    <div class="drawer-item-title">${item.title}</div>
                    <div class="drawer-item-meta">
                        ${item.size ? `<span>Размер: ${item.size}</span>` : ''}
                        ${item.color ? `<span>Цвет: ${item.color}</span>` : ''}
                    </div>
                    <div class="drawer-item-price">
                        ${formatPrice(item.price)} × ${item.quantity}
                    </div>
                </div>
                <button class="drawer-item-remove" data-key="${item.key}" aria-label="Удалить">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        drawerFooter.style.display = 'block';
        drawerTotal.textContent = formatPrice(cart.getTotal());

        // Attach remove listeners
        drawerBody.querySelectorAll('.drawer-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                cart.removeItem(btn.dataset.key);
                showToast('Товар удален из корзины', 'info');
            });
        });
    }
}

// Wishlist Drawer
function initializeWishlistDrawer() {
    const wishlistBtn = document.getElementById('wishlistBtn');
    const wishlistDrawer = document.getElementById('wishlistDrawer');
    const wishlistDrawerOverlay = document.getElementById('wishlistDrawerOverlay');
    const wishlistDrawerClose = document.getElementById('wishlistDrawerClose');

    if (wishlistBtn) {
        wishlistBtn.addEventListener('click', () => {
            window.location.href = '/wishlist';
        });
    }

    const closeDrawer = () => {
        wishlistDrawer.classList.remove('open');
        document.body.style.overflow = '';
    };

    if (wishlistDrawerOverlay) wishlistDrawerOverlay.addEventListener('click', closeDrawer);
    if (wishlistDrawerClose) wishlistDrawerClose.addEventListener('click', closeDrawer);
}

function updateWishlistDrawer() {
    const itemIds = wishlist.getItems();
    const drawerBody = document.getElementById('drawerWishlistItems');
    const drawerCount = document.getElementById('drawerWishlistCount');

    if (!drawerBody) return;

    drawerCount.textContent = itemIds.length;

    if (itemIds.length === 0) {
        drawerBody.innerHTML = `
            <div class="empty-state">
                <i class="far fa-heart empty-icon"></i>
                <p>Избранное пусто</p>
            </div>
        `;
    } else {
        const items = itemIds.map(id => products.find(p => p.id === id)).filter(Boolean);

        drawerBody.innerHTML = items.map(item => `
            <div class="drawer-item">
                <a href="/product?id=${item.id}" class="drawer-item-image" style="background-image: url('${item.images?.[0] || item.image || ''}'); background-size: cover; background-position: center;"></a>
                <div class="drawer-item-info">
                    <a href="/product?id=${item.id}" class="drawer-item-title">${item.title}</a>
                    <div class="drawer-item-price">${formatPrice(item.price)}</div>
                </div>
                <button class="drawer-item-remove" data-id="${item.id}" aria-label="Удалить">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        // Attach remove listeners
        drawerBody.querySelectorAll('.drawer-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                wishlist.removeItem(parseInt(btn.dataset.id));
                showToast('Товар удален из избранного', 'info');
            });
        });
    }
}

// Search Modal
function initializeSearchModal() {
    const searchBtn = document.getElementById('searchBtn');
    const searchModal = document.getElementById('searchModal');
    const searchModalOverlay = document.getElementById('searchModalOverlay');
    const searchModalClose = document.getElementById('searchModalClose');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    if (!searchBtn || !searchModal) return;

    // Load search history
    let searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');

    const openModal = () => {
        searchModal.classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(() => searchInput.focus(), 100);

        // Show search history if input is empty
        if (!searchInput.value) {
            showSearchHistory();
        }
    };

    const closeModal = () => {
        searchModal.classList.remove('open');
        document.body.style.overflow = '';
        searchInput.value = '';
        searchResults.innerHTML = '';
    };

    searchBtn.addEventListener('click', openModal);
    searchModalOverlay.addEventListener('click', closeModal);
    searchModalClose.addEventListener('click', closeModal);

    // Show search history
    const showSearchHistory = () => {
        if (searchHistory.length === 0) {
            searchResults.innerHTML = '<p class="search-hint">История поиска пуста</p>';
            return;
        }

        searchResults.innerHTML = `
            <div class="search-history">
                <div class="search-history-header">
                    <h4>История поиска</h4>
                    <button class="clear-history-btn" id="clearHistoryBtn">Очистить</button>
                </div>
                <div class="search-history-list">
                    ${searchHistory.slice(0, 5).map(term => `
                        <button class="search-history-item" data-query="${term}">
                            <i class="fas fa-history"></i>
                            <span>${term}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Add event listeners
        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
            searchHistory = [];
            localStorage.setItem('searchHistory', '[]');
            searchResults.innerHTML = '<p class="search-hint">История поиска пуста</p>';
        });

        document.querySelectorAll('.search-history-item').forEach(item => {
            item.addEventListener('click', () => {
                searchInput.value = item.dataset.query;
                performSearch(item.dataset.query);
            });
        });
    };

    // Add to search history
    const addToHistory = (query) => {
        if (query.length < 2) return;

        // Remove if exists, then add to beginning
        searchHistory = searchHistory.filter(term => term.toLowerCase() !== query.toLowerCase());
        searchHistory.unshift(query);

        // Keep only last 10
        searchHistory = searchHistory.slice(0, 10);

        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    };

    // Search functionality
    const performSearch = debounce((query) => {
        if (query.length < 2) {
            showSearchHistory();
            return;
        }

        // Add to history
        addToHistory(query);

        // Use products from products-loader or global
        const allProducts = typeof getProducts === 'function' ? getProducts() : (window.products || []);

        const lowerQuery = query.toLowerCase();

        // Enhanced search: name, description, category, tags, SKU
        let results = allProducts.filter(p => {
            const name = (p.title || p.name || '').toLowerCase();
            const description = (p.description || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            const sku = (p.sku || '').toLowerCase();
            const tags = p.tags || [];

            return name.includes(lowerQuery) ||
                description.includes(lowerQuery) ||
                category.includes(lowerQuery) ||
                sku.includes(lowerQuery) ||
                tags.some(tag => tag.toLowerCase().includes(lowerQuery));
        });

        // Sort by relevance (name match first)
        results.sort((a, b) => {
            const aName = (a.title || a.name || '').toLowerCase();
            const bName = (b.title || b.name || '').toLowerCase();
            const aStartsWith = aName.startsWith(lowerQuery);
            const bStartsWith = bName.startsWith(lowerQuery);

            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;
            return 0;
        });

        results = results.slice(0, 8);

        if (results.length === 0) {
            searchResults.innerHTML = `
                <div class="search-no-results">
                    <i class="fas fa-search" style="font-size: 48px; color: #ddd; margin-bottom: 16px;"></i>
                    <p class="search-hint">По запросу "<strong>${query}</strong>" ничего не найдено</p>
                    <p style="font-size: 14px; color: #999;">Попробуйте изменить запрос или <a href="/catalog" style="color: #C9A26C;">посмотреть весь каталог</a></p>
                </div>
            `;
        } else {
            const finalPrice = (product) => product.finalPrice ?? product.price;
            const originalPrice = (product) => product.appliedDiscount ? product.price : (product.oldPrice || product.old_price);
            const hasDiscount = (product) => {
                const orig = originalPrice(product);
                const final = finalPrice(product);
                return orig && orig > final;
            };

            searchResults.innerHTML = `
                <div class="search-results-header">
                    <span>Найдено: ${results.length}</span>
                    <a href="/catalog?search=${encodeURIComponent(query)}" class="view-all-link">Показать все →</a>
                </div>
                <div class="search-results-grid">
                    ${results.map(product => {
                const imageUrl = product.images ? product.images[0] : product.image;
                const final = finalPrice(product);
                const original = originalPrice(product);
                const discount = hasDiscount(product);

                return `
                        <a href="/product?id=${product.id}" class="search-result-item">
                            <div class="search-result-image">
                                <img src="${imageUrl}" alt="${product.title || product.name}">
                                ${discount ? `<span class="search-result-badge">-${Math.round((1 - final / original) * 100)}%</span>` : ''}
                            </div>
                            <div class="search-result-info">
                                <div class="search-result-title">${product.title || product.name}</div>
                                <div class="search-result-category">${product.category}</div>
                                <div class="search-result-price">
                                    <span class="price-current">${formatPrice(final)}</span>
                                    ${discount ? `<span class="price-old">${formatPrice(original)}</span>` : ''}
                                </div>
                            </div>
                        </a>
                    `}).join('')}
                </div>
            `;
        }
    }, 300);

    searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value);
    });

    // Handle Enter key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchInput.value.length >= 2) {
            window.location.href = `/catalog?search=${encodeURIComponent(searchInput.value)}`;
        }
    });
}

// Quick View Modal (used in catalog)
function openQuickView(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('quickViewModal');
    const modalBody = document.getElementById('quickViewBody');

    if (!modal || !modalBody) return;

    const hasDiscount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;

    modalBody.innerHTML = `
        <div class="quick-view-grid">
            <div class="quick-view-image" style="background: linear-gradient(135deg, ${product.images[0]} 0%, ${adjustColor(product.images[0], 20)} 100%)">
                ${product.tags.length > 0 ? `
                    <div class="product-card-badges">
                        ${product.tags.map(tag => {
        if (tag === 'Sale' && hasDiscount) {
            return `<span class="badge-sale">-${hasDiscount}%</span>`;
        } else if (tag === 'New') {
            return `<span class="badge-new">New</span>`;
        } else if (tag === 'Limited') {
            return `<span class="badge-limited">Limited</span>`;
        }
        return '';
    }).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="quick-view-info">
                <h3 class="quick-view-title">${product.title}</h3>
                <div class="product-rating">
                    <div class="rating-stars">${generateStars(product.rating)}</div>
                    <span class="rating-text">${product.rating} (${product.reviewsCount} отзывов)</span>
                </div>
                <div class="product-price">
                    <span class="price-current">${formatPrice(product.price)}</span>
                    ${product.oldPrice ? `<span class="price-old">${formatPrice(product.oldPrice)}</span>` : ''}
                </div>
                <p class="quick-view-description">${product.description}</p>
                <div class="quick-view-actions">
                    <a href="/product?id=${product.id}" class="btn btn-dark">Подробнее</a>
                    <button class="btn btn-outline quick-add-to-cart" data-id="${product.id}">В корзину</button>
                </div>
            </div>
        </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Add to cart button
    modalBody.querySelector('.quick-add-to-cart').addEventListener('click', () => {
        const defaultSize = product.sizes[0];
        const defaultColor = product.colors[0];
        cart.addItem(product, 1, defaultSize, defaultColor);
        showToast('Товар добавлен в корзину', 'success');
        modal.classList.remove('open');
        document.body.style.overflow = '';
    });
}

// Close quick view modal
document.addEventListener('click', (e) => {
    const modal = document.getElementById('quickViewModal');
    if (!modal) return;

    if (e.target.id === 'quickViewOverlay' || e.target.id === 'quickViewClose') {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close any open modals/drawers
        document.querySelectorAll('.modal.open, .drawer.open').forEach(el => {
            el.classList.remove('open');
        });
        document.body.style.overflow = '';
    }
});
