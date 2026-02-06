// Catalog Page Logic

let filteredProducts = [];
let currentPage = 1;
const itemsPerPage = 12;
let currentGridCols = 3;
const BASE_URL = 'https://higherwaist.uz';

// Filters state
const filters = {
    categories: [],
    priceMin: null,
    priceMax: null,
    sizes: [],
    colors: [],
    tags: [],
    rating: null,
    discountOnly: false,
    search: '',
    sort: 'default'
};

function setMetaTag(name, content, isProperty = false) {
    const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    let element = document.querySelector(selector);
    if (!element) {
        element = document.createElement('meta');
        element.setAttribute(isProperty ? 'property' : 'name', name);
        document.head.appendChild(element);
    }
    element.setAttribute('content', content);
}

function setCanonical(url) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
    }
    link.href = url;
}

function updateCatalogSeo(titleSuffix, description) {
    const title = titleSuffix ? `${titleSuffix} · AURA` : 'Каталог · AURA';
    const desc = description || 'Каталог AURA: одежда и аксессуары, подборки и сезонные предложения.';
    const canonicalUrl = `${BASE_URL}${window.location.pathname}${window.location.search}`;

    document.title = title;
    setMetaTag('description', desc);
    setMetaTag('og:site_name', 'AURA', true);
    setMetaTag('og:title', title, true);
    setMetaTag('og:description', desc, true);
    setMetaTag('og:type', 'website', true);
    setMetaTag('og:url', canonicalUrl, true);
    setMetaTag('og:image', `${BASE_URL}/images/logo.PNG`, true);
    setCanonical(canonicalUrl);
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load discounts first, then products with discounts applied
    if (window.discountSystem) {
        await window.discountSystem.loadActiveDiscounts();
    }

    if (typeof loadSiteSettings === 'function') {
        await loadSiteSettings();
    }

    // Load products from API
    await loadProducts();

    // Apply discounts to loaded products
    if (window.discountSystem && window.discountSystem.loaded) {
        products = window.discountSystem.applyDiscountsToProducts(products);
    }

    // Load categories dynamically
    await loadCategoryFilters();

    renderColorFilters();

    // Get loaded products
    const allProducts = typeof getProducts === 'function' ? getProducts() : products;
    filteredProducts = [...allProducts];

    // Parse URL parameters
    parseURLFilters();

    // Initialize filters AFTER categories are loaded
    initializeFilters();

    // Simulate loading
    simulateLoading(() => {
        document.getElementById('productsLoading').style.display = 'none';
        applyFilters();
    }, 800);
});

function renderColorFilters() {
    const container = document.getElementById('colorFilter');
    if (!container) return;

    const fallbackPalette = [
        { name: 'Black', hex: '#2D2D2D' },
        { name: 'White', hex: '#FFFFFF' },
        { name: 'Beige', hex: '#D4C4B0' },
        { name: 'Navy', hex: '#1A2B4A' },
        { name: 'Grey', hex: '#8B8B8B' },
        { name: 'Brown', hex: '#6B4423' }
    ];

    const palette = typeof getColorPalette === 'function' ? getColorPalette() : fallbackPalette;

    container.innerHTML = palette.map(color => {
        const hex = color.hex || '#CCCCCC';
        const isWhite = hex.toLowerCase() === '#ffffff';
        const border = isWhite ? 'border: 1px solid #E8E8E8;' : '';
        return `
            <button class="color-swatch" data-color="${color.name}" style="background: ${hex}; ${border}"
                aria-label="${color.name}"></button>
        `;
    }).join('');
}

// Load categories from API
async function loadCategoryFilters() {
    try {
        const categories = await API.categories.getAll();
        const categoryFilter = document.getElementById('categoryFilter');

        if (categories && categories.length > 0) {
            const visibleCategories = categories.filter(cat => cat.is_visible !== false);

            categoryFilter.innerHTML = visibleCategories.map(cat => `
                <label class="filter-checkbox">
                    <input type="checkbox" value="${cat.slug}" data-category-id="${cat.id}" data-category-name="${cat.name}">
                    <span>${cat.name}</span>
                </label>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
        // Fallback to hardcoded categories if API fails
        const categoryFilter = document.getElementById('categoryFilter');
        categoryFilter.innerHTML = `
            <label class="filter-checkbox">
                <input type="checkbox" value="outerwear">
                <span>Верхняя одежда</span>
            </label>
            <label class="filter-checkbox">
                <input type="checkbox" value="tops">
                <span>Топы</span>
            </label>
            <label class="filter-checkbox">
                <input type="checkbox" value="bottoms">
                <span>Низ</span>
            </label>
            <label class="filter-checkbox">
                <input type="checkbox" value="shoes">
                <span>Обувь</span>
            </label>
            <label class="filter-checkbox">
                <input type="checkbox" value="accessories">
                <span>Аксессуары</span>
            </label>
        `;
    }
}

function parseURLFilters() {
    const category = getUrlParam('category');
    const tag = getUrlParam('tag');
    const search = getUrlParam('search');

    let seoTitle = '';
    let seoDescription = '';

    if (category && category !== 'all') {
        filters.categories = [category];
        const categoryTitle = getCategoryTitle(category);
        document.getElementById('catalogTitle').textContent = categoryTitle;
        document.getElementById('breadcrumbCurrent').textContent = categoryTitle;
        seoTitle = categoryTitle;
        seoDescription = `Каталог AURA: ${categoryTitle}.`;
    }

    if (tag) {
        filters.tags = [tag];
        const tagTitle = getTagTitle(tag);
        document.getElementById('catalogTitle').textContent = tagTitle;
        document.getElementById('breadcrumbCurrent').textContent = tagTitle;
        seoTitle = tagTitle;
        seoDescription = `Каталог AURA: ${tagTitle}.`;
    }

    if (search) {
        filters.search = search.toLowerCase();
        document.getElementById('catalogTitle').textContent = `Поиск: "${search}"`;
        document.getElementById('breadcrumbCurrent').textContent = 'Результаты поиска';
        seoTitle = `Поиск: ${search}`;
        seoDescription = `Результаты поиска по запросу "${search}" в каталоге AURA.`;

        // Update search input if it exists
        const searchInput = document.getElementById('catalogSearch');
        if (searchInput) {
            searchInput.value = search;
        }
    }

    updateCatalogSeo(seoTitle, seoDescription);
}

function getCategoryTitle(category) {
    const titles = {
        'Outerwear': 'Верхняя одежда',
        'Tops': 'Топы',
        'Bottoms': 'Низ',
        'Shoes': 'Обувь',
        'Accessories': 'Аксессуары'
    };
    return titles[category] || 'Каталог';
}

function getTagTitle(tag) {
    const titles = {
        'New': 'Новинки',
        'Sale': 'Распродажа',
        'Limited': 'Лимитированная коллекция'
    };
    return titles[tag] || 'Каталог';
}

function initializeFilters() {
    const filtersSidebar = document.getElementById('filtersSidebar');
    const filterToggleBtn = document.getElementById('filterToggleBtn');

    // Mobile filter toggle
    filterToggleBtn.addEventListener('click', () => {
        filtersSidebar.classList.toggle('open');
    });

    // Category checkboxes
    document.querySelectorAll('#categoryFilter input[type="checkbox"]').forEach(cb => {
        if (filters.categories.includes(cb.value)) {
            cb.checked = true;
        }
        cb.addEventListener('change', () => {
            if (cb.checked) {
                filters.categories.push(cb.value);
            } else {
                filters.categories = filters.categories.filter(c => c !== cb.value);
            }
            applyFilters();
        });
    });

    // Price inputs
    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');

    // Manual input sync
    const updatePriceFromInputs = debounce(() => {
        const minVal = priceMin.value ? parseInt(priceMin.value) : 0;
        const maxVal = priceMax.value ? parseInt(priceMax.value) : 50000000;

        filters.priceMin = minVal;
        filters.priceMax = maxVal;

        applyFilters();
    }, 500);

    priceMin.addEventListener('input', updatePriceFromInputs);
    priceMax.addEventListener('input', updatePriceFromInputs);

    // Create debounced apply filters
    const debounceApplyFilters = debounce(() => {
        applyFilters();
    }, 300);

    // Size chips
    document.querySelectorAll('#sizeFilter .filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            const size = chip.dataset.value;

            if (chip.classList.contains('active')) {
                filters.sizes.push(size);
            } else {
                filters.sizes = filters.sizes.filter(s => s !== size);
            }
            applyFilters();
        });
    });

    // Color swatches
    document.querySelectorAll('#colorFilter .color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            swatch.classList.toggle('active');
            const color = swatch.dataset.color;

            if (swatch.classList.contains('active')) {
                filters.colors.push(color);
            } else {
                filters.colors = filters.colors.filter(c => c !== color);
            }
            applyFilters();
        });
    });

    // Tag checkboxes
    document.querySelectorAll('#tagFilter input[type="checkbox"]').forEach(cb => {
        if (filters.tags.includes(cb.value)) {
            cb.checked = true;
        }
        cb.addEventListener('change', () => {
            if (cb.checked) {
                filters.tags.push(cb.value);
            } else {
                filters.tags = filters.tags.filter(t => t !== cb.value);
            }
            applyFilters();
        });
    });

    // Rating filter (new star-based UI)
    document.querySelectorAll('#ratingFilterGroup .rating-option').forEach(btn => {
        btn.addEventListener('click', () => {
            // Toggle active state
            const currentlyActive = btn.classList.contains('active');

            // Remove active from all
            document.querySelectorAll('#ratingFilterGroup .rating-option').forEach(b => {
                b.classList.remove('active');
            });

            // If it wasn't active, activate it
            if (!currentlyActive) {
                btn.classList.add('active');
                filters.rating = parseInt(btn.dataset.rating);
            } else {
                filters.rating = null;
            }

            applyFilters();
        });
    });

    // Discount filter
    document.getElementById('discountFilter').addEventListener('change', (e) => {
        filters.discountOnly = e.target.checked;
        applyFilters();
    });

    // Search input
    const catalogSearch = document.getElementById('catalogSearch');
    catalogSearch.addEventListener('input', debounce((e) => {
        filters.search = e.target.value.toLowerCase();
        applyFilters();
    }, 300));

    // Sort select
    document.getElementById('sortSelect').addEventListener('change', (e) => {
        filters.sort = e.target.value;
        applyFilters();
    });

    // Grid toggle
    document.querySelectorAll('.grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.grid-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentGridCols = parseInt(btn.dataset.cols);
            updateGridColumns();
        });
    });

    // Reset filters
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
}

function resetFilters() {
    // Reset state
    filters.categories = [];
    filters.priceMin = 0;
    filters.priceMax = 50000000;
    filters.sizes = [];
    filters.colors = [];
    filters.tags = [];
    filters.rating = null;
    filters.discountOnly = false;
    filters.search = '';
    filters.sort = 'default';

    // Reset UI
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('priceMin').value = '';
    document.getElementById('priceMax').value = '';
    document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
    document.querySelectorAll('.color-swatch').forEach(swatch => swatch.classList.remove('active'));
    document.querySelectorAll('.rating-option').forEach(btn => btn.classList.remove('active'));
    document.getElementById('catalogSearch').value = '';
    document.getElementById('sortSelect').value = 'default';

    applyFilters();
}

function applyFilters() {
    // Get all products
    const allProducts = typeof getProducts === 'function' ? getProducts() : products;

    // Start with all products
    filteredProducts = [...allProducts];

    console.log('Total products:', filteredProducts.length);
    console.log('Active filters:', filters);

    // Apply category filter
    if (filters.categories.length > 0) {
        filteredProducts = filteredProducts.filter(p => {
            // Support both category name (string) and category field
            const productCategory = p.category || p.category_name || '';
            const matches = filters.categories.includes(productCategory);
            if (!matches) {
                console.log('Product filtered out:', p.title, 'Category:', productCategory, 'Expected:', filters.categories);
            }
            return matches;
        });
        console.log('After category filter:', filteredProducts.length);
    }

    // Apply price filter (use finalPrice if available from discounts)
    if (filters.priceMin !== null && filters.priceMin > 0) {
        filteredProducts = filteredProducts.filter(p => (p.finalPrice ?? p.price) >= filters.priceMin);
    }
    if (filters.priceMax !== null && filters.priceMax < 50000000) {
        filteredProducts = filteredProducts.filter(p => (p.finalPrice ?? p.price) <= filters.priceMax);
    }

    // Apply size filter
    if (filters.sizes.length > 0) {
        filteredProducts = filteredProducts.filter(p =>
            p.sizes && p.sizes.some(size => filters.sizes.includes(size))
        );
    }

    // Apply color filter
    if (filters.colors.length > 0) {
        filteredProducts = filteredProducts.filter(p =>
            p.colors && p.colors.some(color => filters.colors.includes(color))
        );
    }

    // Apply tag filter
    if (filters.tags.length > 0) {
        filteredProducts = filteredProducts.filter(p =>
            p.tags && p.tags.some(tag => filters.tags.includes(tag))
        );
    }

    // Apply rating filter
    if (filters.rating) {
        filteredProducts = filteredProducts.filter(p => p.rating >= filters.rating);
    }

    // Apply discount filter
    if (filters.discountOnly) {
        filteredProducts = filteredProducts.filter(p => p.appliedDiscount || p.discountPercent);
    }

    // Apply search filter (enhanced)
    if (filters.search) {
        filteredProducts = filteredProducts.filter(p => {
            const name = (p.title || p.name || '').toLowerCase();
            const description = (p.description || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            const sku = (p.sku || '').toLowerCase();
            const tags = p.tags || [];

            return name.includes(filters.search) ||
                description.includes(filters.search) ||
                category.includes(filters.search) ||
                sku.includes(filters.search) ||
                tags.some(tag => tag.toLowerCase().includes(filters.search));
        });
    }

    // Apply sorting
    sortProducts();

    // Reset pagination
    currentPage = 1;

    // Render
    renderCatalog();
}

function sortProducts() {
    switch (filters.sort) {
        case 'price-asc':
            filteredProducts.sort((a, b) => (a.finalPrice ?? a.price) - (b.finalPrice ?? b.price));
            break;
        case 'price-desc':
            filteredProducts.sort((a, b) => (b.finalPrice ?? b.price) - (a.finalPrice ?? a.price));
            break;
        case 'rating':
            filteredProducts.sort((a, b) => b.rating - a.rating);
            break;
        case 'new':
            filteredProducts.sort((a, b) => {
                const aNew = a.tags.includes('New') ? 1 : 0;
                const bNew = b.tags.includes('New') ? 1 : 0;
                return bNew - aNew;
            });
            break;
        default:
            // Default order
            break;
    }
}

function renderCatalog() {
    const catalogProducts = document.getElementById('catalogProducts');
    const emptyState = document.getElementById('emptyState');
    const pagination = document.getElementById('pagination');

    if (filteredProducts.length === 0) {
        catalogProducts.style.display = 'none';
        pagination.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        emptyState.style.display = 'none';
        catalogProducts.style.display = 'grid';

        // Paginate
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageProducts = filteredProducts.slice(0, endIndex);

        catalogProducts.innerHTML = pageProducts.map(product => renderProductCard(product)).join('');
        attachProductCardListeners(catalogProducts);

        // Show/hide load more button
        if (endIndex < filteredProducts.length) {
            pagination.style.display = 'flex';
            document.getElementById('loadMoreBtn').onclick = () => {
                currentPage++;
                renderCatalog();
            };
        } else {
            pagination.style.display = 'none';
        }
    }

    // Close mobile filters
    document.getElementById('filtersSidebar').classList.remove('open');
}

function updateGridColumns() {
    const catalogProducts = document.getElementById('catalogProducts');
    catalogProducts.className = `products-grid products-grid-${currentGridCols}`;
}
