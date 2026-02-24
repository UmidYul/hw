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
    discountOnly: false,
    search: '',
    sort: 'default'
};

const COLOR_ALIASES = {
    black: 'black',
    'черный': 'black',
    'чёрный': 'black',
    white: 'white',
    'белый': 'white',
    beige: 'beige',
    'бежевый': 'beige',
    navy: 'navy',
    'темно-синий': 'navy',
    'тёмно-синий': 'navy',
    'синий': 'navy',
    grey: 'grey',
    gray: 'grey',
    'серый': 'grey',
    brown: 'brown',
    'коричневый': 'brown'
};

function normalizeFilterToken(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ');
}

function normalizeSizeValue(value) {
    return String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ');
}

function normalizeHexColor(value) {
    const token = String(value ?? '').trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(token)) return token;
    if (/^#[0-9a-f]{3}$/.test(token)) {
        return `#${token[1]}${token[1]}${token[2]}${token[2]}${token[3]}${token[3]}`;
    }
    return '';
}

function normalizeColorValue(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const normalizedHex = normalizeHexColor(raw);
    if (normalizedHex) return normalizedHex;

    const normalized = normalizeFilterToken(raw);
    if (!normalized) return '';

    if (COLOR_ALIASES[normalized]) {
        return COLOR_ALIASES[normalized];
    }

    if (typeof getColorHex === 'function') {
        const hex = normalizeHexColor(getColorHex(raw));
        if (hex) return hex;
    }

    return normalized;
}

function parseListValue(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
        } catch (error) {
            // Fall back to comma-separated values
        }

        return trimmed
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
    }

    if (typeof value === 'object') {
        return Object.values(value);
    }

    return [];
}

function parseVariantsValue(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }
    return [];
}

function getAvailableSizesForProduct(product) {
    const variants = parseVariantsValue(product?.variants);
    const sizeFromVariants = variants
        .filter(v => v && v.size && (v.stock === undefined || Number(v.stock) > 0))
        .map(v => v.size);
    const sizeSource = sizeFromVariants.length > 0 ? sizeFromVariants : parseListValue(product?.sizes);

    return Array.from(new Set(
        sizeSource
            .map(size => normalizeSizeValue(size))
            .filter(Boolean)
    ));
}

function getAvailableColorsForProduct(product) {
    const variants = parseVariantsValue(product?.variants);
    const colorFromVariants = variants
        .filter(v => v && v.color && (v.stock === undefined || Number(v.stock) > 0))
        .map(v => v.color);
    const colorSource = colorFromVariants.length > 0 ? colorFromVariants : parseListValue(product?.colors);

    return Array.from(new Set(
        colorSource
            .map(color => normalizeColorValue(color))
            .filter(Boolean)
    ));
}

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
    const title = titleSuffix ? `${titleSuffix} · Higher Waist` : 'Каталог · Higher Waist';
    const desc = description || 'Каталог Higher Waist: одежда и аксессуары, подборки и сезонные предложения.';
    const canonicalUrl = `${BASE_URL}${window.location.pathname}${window.location.search}`;

    document.title = title;
    setMetaTag('description', desc);
    setMetaTag('og:site_name', 'Higher Waist', true);
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

    // Load banners for this page and render catalog-top if available
    if (typeof loadBanners === 'function') {
        await loadBanners();
        if (typeof renderCatalogTop === 'function') renderCatalogTop();
    }

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
        seoDescription = `Каталог Higher Waist: ${categoryTitle}.`;
    }

    if (tag) {
        filters.tags = [tag];
        const tagTitle = getTagTitle(tag);
        document.getElementById('catalogTitle').textContent = tagTitle;
        document.getElementById('breadcrumbCurrent').textContent = tagTitle;
        seoTitle = tagTitle;
        seoDescription = `Каталог Higher Waist: ${tagTitle}.`;
    }

    if (search) {
        filters.search = search.toLowerCase();
        document.getElementById('catalogTitle').textContent = `Поиск: "${search}"`;
        document.getElementById('breadcrumbCurrent').textContent = 'Результаты поиска';
        seoTitle = `Поиск: ${search}`;
        seoDescription = `Результаты поиска по запросу "${search}" в каталоге Higher Waist.`;

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
        const isOpen = filtersSidebar.classList.toggle('open');
        document.body.classList.toggle('filters-open', isOpen);
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
            const size = normalizeSizeValue(chip.dataset.value);
            if (!size) return;

            if (chip.classList.contains('active')) {
                if (!filters.sizes.includes(size)) {
                    filters.sizes.push(size);
                }
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
            const color = normalizeColorValue(swatch.dataset.color);
            if (!color) return;

            if (swatch.classList.contains('active')) {
                if (!filters.colors.includes(color)) {
                    filters.colors.push(color);
                }
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
    filters.discountOnly = false;
    filters.search = '';
    filters.sort = 'default';

    // Reset UI
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('priceMin').value = '';
    document.getElementById('priceMax').value = '';
    document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
    document.querySelectorAll('.color-swatch').forEach(swatch => swatch.classList.remove('active'));
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
        const selectedSizes = new Set(filters.sizes.map(size => normalizeSizeValue(size)).filter(Boolean));
        filteredProducts = filteredProducts.filter((p) => {
            const productSizes = getAvailableSizesForProduct(p);
            return productSizes.some(size => selectedSizes.has(size));
        });
    }

    // Apply color filter
    if (filters.colors.length > 0) {
        const selectedColors = new Set(filters.colors.map(color => normalizeColorValue(color)).filter(Boolean));
        filteredProducts = filteredProducts.filter((p) => {
            const productColors = getAvailableColorsForProduct(p);
            return productColors.some(color => selectedColors.has(color));
        });
    }

    // Apply tag filter
    if (filters.tags.length > 0) {
        filteredProducts = filteredProducts.filter((p) => {
            const tags = parseListValue(p.tags);
            return tags.some(tag => filters.tags.includes(tag));
        });
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
            const tags = parseListValue(p.tags);

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
        case 'new':
            filteredProducts.sort((a, b) => {
                const aTags = parseListValue(a.tags);
                const bTags = parseListValue(b.tags);
                const aNew = aTags.includes('New') ? 1 : 0;
                const bNew = bTags.includes('New') ? 1 : 0;
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
    document.body.classList.remove('filters-open');
}

function updateGridColumns() {
    const catalogProducts = document.getElementById('catalogProducts');
    catalogProducts.className = `products-grid products-grid-${currentGridCols}`;
}
