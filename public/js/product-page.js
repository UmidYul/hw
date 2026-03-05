// Product Page Logic

let currentProduct = null;
let selectedColor = null;
let selectedSize = null;
let quantity = 1;
let currentLightboxIndex = 0;
let currentGalleryIndex = 0;
let productImages = [];
const BASE_URL = 'https://higherwaist.uz';
const MOBILE_GALLERY_BREAKPOINT = 768;

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

function toAbsoluteUrl(url) {
    if (!url) return `${BASE_URL}/images/logo.PNG`;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${BASE_URL}${url}`;
    return `${BASE_URL}/${url}`;
}

function getOptimizedImageUrl(url, { width = 1200, quality = 85 } = {}) {
    if (!url || typeof url !== 'string') return url;

    try {
        const parsed = new URL(url, window.location.origin);
        const hostname = parsed.hostname.toLowerCase();

        // Unsplash supports server-side resizing and format conversion.
        if (hostname.includes('unsplash.com')) {
            parsed.searchParams.set('auto', 'format');
            parsed.searchParams.set('fit', 'max');
            parsed.searchParams.set('q', String(quality));
            parsed.searchParams.set('w', String(width));
            return parsed.toString();
        }

        return url;
    } catch (error) {
        return url;
    }
}

function updateProductSeo(product, finalPrice, inStock) {
    const description = (product.description || 'Товар Higher Waist.').replace(/<[^>]*>/g, '').trim();
    const shortDescription = description.length > 160 ? `${description.slice(0, 157)}...` : description;
    const rawImageUrl = Array.isArray(product.images) ? product.images[0] : (product.images || product.image || `${BASE_URL}/images/logo.PNG`);
    const imageUrl = toAbsoluteUrl(rawImageUrl);
    const canonicalUrl = `${BASE_URL}/product?id=${product.id}`;

    document.title = `${product.title} · Higher Waist`;
    setMetaTag('description', shortDescription);
    setMetaTag('og:site_name', 'Higher Waist', true);
    setMetaTag('og:title', `${product.title} · Higher Waist`, true);
    setMetaTag('og:description', shortDescription, true);
    setMetaTag('og:type', 'product', true);
    setMetaTag('og:url', canonicalUrl, true);
    setMetaTag('og:image', imageUrl, true);
    setCanonical(canonicalUrl);

    const schema = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.title,
        image: imageUrl ? [imageUrl] : [],
        description: shortDescription,
        sku: product.sku || `SKU-${product.id}`,
        offers: {
            "@type": "Offer",
            priceCurrency: "UZS",
            price: String(finalPrice),
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: canonicalUrl
        }
    };

    let schemaEl = document.getElementById('product-schema');
    if (!schemaEl) {
        schemaEl = document.createElement('script');
        schemaEl.type = 'application/ld+json';
        schemaEl.id = 'product-schema';
        document.head.appendChild(schemaEl);
    }
    schemaEl.textContent = JSON.stringify(schema);
}

function getVariants(product) {
    return Array.isArray(product?.variants) ? product.variants : [];
}

function getSelectedVariant(product) {
    const variants = getVariants(product);
    if (!variants.length) return null;
    return variants.find(v => v.color === selectedColor && v.size === selectedSize) || null;
}

function getMaxQuantity(product) {
    const variants = getVariants(product);
    if (variants.length > 0) {
        const selectedVariant = getSelectedVariant(product);
        return selectedVariant ? (selectedVariant.stock || 0) : 0;
    }

    return product?.stock || 0;
}

function splitFormattedPrice(formattedPrice) {
    const normalized = String(formattedPrice || '')
        .replace(/\u00A0/g, ' ')
        .trim();

    if (!normalized) {
        return { amount: '', currency: '' };
    }

    const parts = normalized.split(/\s+/);
    if (parts.length === 1) {
        return { amount: normalized, currency: '' };
    }

    return {
        amount: parts.slice(0, -1).join(' '),
        currency: parts.at(-1)
    };
}

function normalizeCurrencyLabel(currency) {
    const value = String(currency || '').trim();
    if (!value) return '';

    const lower = value.toLowerCase();
    if (
        lower === 'uzs' ||
        lower.includes('sum') ||
        lower.includes('\u0441\u0443\u043c')
    ) {
        return '\u0441\u0443\u043c';
    }

    return value;
}

function setStyledPrice(target, value) {
    if (!target) return;

    const formatted = formatPrice(value);
    const { amount, currency } = splitFormattedPrice(formatted);

    target.textContent = '';

    const amountEl = document.createElement('span');
    amountEl.className = 'price-amount';
    amountEl.textContent = amount || formatted;
    target.appendChild(amountEl);

    const normalizedCurrency = normalizeCurrencyLabel(currency);
    if (normalizedCurrency) {
        const currencyEl = document.createElement('span');
        currencyEl.className = 'price-currency';
        currencyEl.textContent = normalizedCurrency;
        target.appendChild(currencyEl);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load products from API
    await loadProducts();

    if (typeof loadSiteSettings === 'function') {
        await loadSiteSettings();
    }

    const productId = getUrlParam('id');

    if (!productId) {
        window.location.href = '/catalog';
        return;
    }

    currentProduct = typeof getProductById === 'function'
        ? getProductById(productId)
        : products.find(p => String(p.id) === String(productId));

    if (!currentProduct) {
        window.location.href = '/catalog';
        return;
    }

    // Add to recently viewed
    recentlyViewed.add(String(productId));

    // Render product
    renderProduct();

    // Initialize interactions
    initializeProductPage();

    // Size guide
    initializeSizeGuide();

    // Initialize lightbox
    initializeLightbox();

    // Load related products
    loadRelatedProducts();
});

function parseSizeTable(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()).filter(Boolean));
    const cleaned = rows.filter(row => row.length > 0);
    if (cleaned.length < 2) return null;
    return cleaned;
}

function renderSizeTable(rows) {
    const [header, ...body] = rows;
    const headerHtml = header.map(cell => `<th>${cell}</th>`).join('');
    const bodyHtml = body.map(row => `
        <tr>
            ${row.map(cell => `<td>${cell}</td>`).join('')}
        </tr>
    `).join('');

    return `
        <table class="size-guide-table">
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${bodyHtml}</tbody>
        </table>
    `;
}

function initializeSizeGuide() {
    const buttons = document.querySelectorAll('.size-guide-btn');
    if (!buttons.length) return;

    const modal = document.getElementById('sizeGuideModal');
    const overlay = document.getElementById('sizeGuideOverlay');
    const closeBtn = document.getElementById('sizeGuideClose');
    const body = document.getElementById('sizeGuideBody');
    if (!modal || !overlay || !closeBtn || !body) return;

    const openModal = () => {
        const rows = parseSizeTable(siteSettings?.sizeTable || '');
        if (!rows) {
            body.innerHTML = '<div class="size-guide-empty">Таблица размеров пока не заполнена.</div>';
        } else {
            body.innerHTML = renderSizeTable(rows);
        }
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    };

    buttons.forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            openModal();
        });
    });

    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('open')) {
            closeModal();
        }
    });
}

function renderProduct() {
    const product = currentProduct;

    // Update breadcrumbs
    document.getElementById('productCategoryLink').href = `/catalog?category=${product.category}`;
    document.getElementById('productCategoryLink').textContent = getCategoryTitle(product.category);
    document.getElementById('productBreadcrumb').textContent = product.title;

    // Render gallery
    renderGallery();

    // Get prices with discount
    const finalPrice = product.finalPrice ?? product.price;
    const originalPrice = product.appliedDiscount ? product.price : (product.oldPrice || product.old_price);

    // Calculate discount percentage
    let discountPercent = 0;
    if (product.appliedDiscount) {
        discountPercent = product.discountPercent || Math.round((1 - finalPrice / product.price) * 100);
    } else if (originalPrice && originalPrice > finalPrice) {
        discountPercent = Math.round((1 - finalPrice / originalPrice) * 100);
    }
    const hasDiscount = discountPercent > 0;

    // Render tags
    const variants = getVariants(product);
    const stockCount = variants.length > 0
        ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : (product.stock || 0);
    const isOutOfStock = stockCount === 0;

    updateProductSeo(product, finalPrice, !isOutOfStock);

    let tagsHtml = '';
    if (isOutOfStock) {
        tagsHtml += `<span class="badge-limited">Распродано</span>`;
    }
    if (hasDiscount) {
        tagsHtml += `<span class="badge-sale">-${discountPercent}%</span>`;
    }
    if (product.tags && product.tags.length > 0) {
        tagsHtml += product.tags.map(tag => {
            if (tag === 'New') {
                return `<span class="badge-new">New</span>`;
            } else if (tag === 'Limited') {
                return `<span class="badge-limited">Limited</span>`;
            }
            return '';
        }).join('');
    }
    if (tagsHtml) {
        document.getElementById('productTags').innerHTML = tagsHtml;
    }

    // Title
    document.getElementById('productTitle').textContent = product.title;

    // Price
    const productPriceEl = document.getElementById('productPrice');
    const productOldPriceEl = document.getElementById('productOldPrice');

    setStyledPrice(productPriceEl, finalPrice);

    if (originalPrice && originalPrice > finalPrice) {
        productOldPriceEl.style.display = 'inline-flex';
        setStyledPrice(productOldPriceEl, originalPrice);
    } else {
        productOldPriceEl.style.display = 'none';
        productOldPriceEl.textContent = '';
    }

    // Colors
    renderColors();

    // Sizes
    renderSizes();

    // Accordions
    document.getElementById('accordionDescription').innerHTML = `<div class="accordion-content-inner"><p>${product.description}</p></div>`;
    document.getElementById('accordionMaterials').innerHTML = `
        <div class="accordion-content-inner">
            <p><strong>Состав:</strong> ${product.material}</p>
            <p><strong>Уход:</strong> ${product.care}</p>
            <p><strong>Крой:</strong> ${product.fit}</p>
        </div>
    `;
    const defaultDeliveryText = (siteSettings?.deliveryTimeline || '').trim() || 'Доставка 3-5 дней';
    document.getElementById('accordionDelivery').innerHTML = `<div class="accordion-content-inner"><p>${product.deliveryInfo || product.delivery_info || defaultDeliveryText}</p></div>`;

    // Check if in wishlist
    updateWishlistButton();
}

function renderGallery() {
    const product = currentProduct;
    const galleryMain = document.getElementById('galleryMain');
    const galleryThumbs = document.getElementById('galleryThumbs');
    const isMobileViewport = window.innerWidth <= MOBILE_GALLERY_BREAKPOINT;

    // Get images - handle both array and single image
    productImages = (Array.isArray(product.images) ? product.images : (product.images ? [product.images] : [product.image || 'https://via.placeholder.com/600']))
        .filter(Boolean);
    const thumbImages = productImages.map((url) => getOptimizedImageUrl(url, { width: 320, quality: 78 }));
    productImages = productImages.map((url) => getOptimizedImageUrl(url, { width: 1400, quality: 86 }));
    currentGalleryIndex = 0;


    galleryMain.innerHTML = '';
    galleryThumbs.innerHTML = '';

    // Добавим стрелки
    const leftArrow = document.createElement('button');
    leftArrow.className = 'gallery-arrow gallery-arrow-left';
    leftArrow.id = 'galleryArrowLeft';
    leftArrow.setAttribute('aria-label', 'Предыдущее фото');
    leftArrow.innerHTML = '<i class="fas fa-chevron-left"></i>';

    const rightArrow = document.createElement('button');
    rightArrow.className = 'gallery-arrow gallery-arrow-right';
    rightArrow.id = 'galleryArrowRight';
    rightArrow.setAttribute('aria-label', 'Следующее фото');
    rightArrow.innerHTML = '<i class="fas fa-chevron-right"></i>';

    const galleryTrack = document.createElement('div');
    galleryTrack.className = 'gallery-main-track';
    galleryTrack.id = 'galleryMainTrack';

    productImages.forEach((img, index) => {
        const slide = document.createElement('div');
        slide.className = 'gallery-slide';
        slide.dataset.index = String(index);

        const image = document.createElement('img');
        image.className = 'gallery-image';
        image.src = img;
        image.alt = `${product.title} - фото ${index + 1}`;
        image.loading = index === 0 ? 'eager' : 'lazy';
        image.decoding = 'async';
        if (index === 0) {
            image.fetchPriority = 'high';
        }
        image.dataset.index = String(index);

        // On mobile, users browse by horizontal scroll without opening lightbox.
        if (!isMobileViewport) {
            image.style.cursor = 'zoom-in';
            image.addEventListener('click', () => openLightbox(index));
        }

        slide.appendChild(image);
        galleryTrack.appendChild(slide);
    });


    galleryMain.appendChild(leftArrow);
    galleryMain.appendChild(galleryTrack);
    galleryMain.appendChild(rightArrow);

    // Обработчики стрелок
    leftArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        scrollToImage(currentGalleryIndex - 1);
    });
    rightArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        scrollToImage(currentGalleryIndex + 1);
    });

    if (productImages.length <= 1) {
        return;
    }

    galleryThumbs.innerHTML = thumbImages.map((img, index) => `
        <div class="gallery-thumb ${index === 0 ? 'active' : ''}" data-index="${index}" style="background-image: url('${img}'); background-size: cover; background-position: center;"></div>
    `).join('');

    const setActiveThumb = (index) => {
        galleryThumbs.querySelectorAll('.gallery-thumb').forEach((thumb) => {
            thumb.classList.toggle('active', Number(thumb.dataset.index) === index);
        });
    };

    const scrollToImage = (index, behavior = 'smooth') => {
        const maxIndex = productImages.length - 1;
        const safeIndex = Math.max(0, Math.min(maxIndex, index));
        const slideWidth = galleryMain.clientWidth;
        galleryTrack.scrollTo({ left: slideWidth * safeIndex, behavior });
        currentGalleryIndex = safeIndex;
        setActiveThumb(safeIndex);
    };

    galleryThumbs.querySelectorAll('.gallery-thumb').forEach((thumb) => {
        thumb.addEventListener('click', () => {
            const index = parseInt(thumb.dataset.index, 10);
            scrollToImage(index);
        });
    });

    let scrollFrame = null;
    galleryTrack.addEventListener('scroll', () => {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
            scrollFrame = null;
            const slideWidth = galleryMain.clientWidth || 1;
            const index = Math.round(galleryTrack.scrollLeft / slideWidth);
            if (index !== currentGalleryIndex) {
                currentGalleryIndex = index;
                setActiveThumb(index);
            }
        });
    }, { passive: true });

    window.requestAnimationFrame(() => {
        scrollToImage(0, 'auto');
    });
}

function renderColors() {
    const product = currentProduct;
    const colorsContainer = document.getElementById('productColors');
    const variants = getVariants(product);

    const fallbackPalette = [
        { name: 'Black', hex: '#2D2D2D' },
        { name: 'White', hex: '#FFFFFF' },
        { name: 'Beige', hex: '#D4C4B0' },
        { name: 'Navy', hex: '#1A2B4A' },
        { name: 'Grey', hex: '#8B8B8B' },
        { name: 'Brown', hex: '#6B4423' }
    ];

    const palette = typeof getColorPalette === 'function' ? getColorPalette() : fallbackPalette;
    const findColorHex = (colorName) => {
        if (typeof getColorHex === 'function') {
            const hex = getColorHex(colorName);
            if (hex) return hex;
        }
        const match = palette.find(item => item.name === colorName);
        return match ? match.hex : '#CCCCCC';
    };

    const isColorAvailable = (color) => {
        if (!variants.length) return true;
        if (selectedSize) {
            return variants.some(v => v.color === color && v.size === selectedSize && (v.stock || 0) > 0);
        }
        return variants.some(v => v.color === color && (v.stock || 0) > 0);
    };

    const colors = product.colors || [];
    const firstAvailableColor = colors.find(color => isColorAvailable(color));

    if (!selectedColor || !isColorAvailable(selectedColor)) {
        selectedColor = firstAvailableColor || colors[0] || null;
    }

    document.getElementById('selectedColorName').textContent = selectedColor || '';
    colorsContainer.innerHTML = colors.map((color) => {
        const available = isColorAvailable(color);
        const hex = findColorHex(color);
        const isWhite = hex.toLowerCase() === '#ffffff';
        const classes = [
            'color-swatch-large',
            color === selectedColor ? 'active' : '',
            available ? '' : 'disabled'
        ].filter(Boolean).join(' ');

        return `
            <button class="${classes}" 
                    data-color="${color}" 
                    ${available ? '' : 'disabled'}
                    style="background: ${hex}${isWhite ? '; border: 1px solid #E8E8E8' : ''}" 
                    aria-label="${color}">
            </button>
        `;
    }).join('');

    // Color click handler
    colorsContainer.querySelectorAll('.color-swatch-large').forEach(swatch => {
        swatch.addEventListener('click', () => {
            if (swatch.classList.contains('disabled')) return;
            colorsContainer.querySelectorAll('.color-swatch-large').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            selectedColor = swatch.dataset.color;
            document.getElementById('selectedColorName').textContent = selectedColor;
            renderSizes();
            updateQuantityLimit();
        });
    });
}

function renderSizes() {
    const product = currentProduct;
    const sizesContainer = document.getElementById('productSizes');
    const variants = getVariants(product);

    const isSizeAvailable = (size) => {
        if (!variants.length) return true;
        if (selectedColor) {
            return variants.some(v => v.size === size && v.color === selectedColor && (v.stock || 0) > 0);
        }
        return variants.some(v => v.size === size && (v.stock || 0) > 0);
    };

    const sizes = product.sizes || [];
    const firstAvailableSize = sizes.find(size => isSizeAvailable(size));

    if (!selectedSize || !isSizeAvailable(selectedSize)) {
        selectedSize = firstAvailableSize || sizes[0] || null;
    }
    document.getElementById('selectedSizeName').textContent = selectedSize || '';

    sizesContainer.innerHTML = sizes.map((size) => {
        const available = isSizeAvailable(size);
        const classes = [
            'size-chip',
            size === selectedSize ? 'active' : '',
            available ? '' : 'disabled'
        ].filter(Boolean).join(' ');

        return `<button class="${classes}" data-size="${size}" ${available ? '' : 'disabled'}>${size}</button>`;
    }).join('');

    // Size click handler
    sizesContainer.querySelectorAll('.size-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            if (chip.classList.contains('disabled')) return;
            sizesContainer.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedSize = chip.dataset.size;
            document.getElementById('selectedSizeName').textContent = selectedSize;
            renderColors();
            updateQuantityLimit();
        });
    });
}

function updateQuantityLimit() {
    const qtyInput = document.getElementById('qtyInput');
    const qtyMinus = document.getElementById('qtyMinus');
    const qtyPlus = document.getElementById('qtyPlus');

    if (!qtyInput || !qtyMinus || !qtyPlus) return;

    const maxQty = getMaxQuantity(currentProduct);
    const effectiveMax = Math.max(1, maxQty);

    qtyInput.max = String(effectiveMax);

    if (quantity > effectiveMax) {
        quantity = effectiveMax;
        qtyInput.value = quantity;
    }

    const controlsDisabled = maxQty <= 0;
    qtyInput.disabled = controlsDisabled;
    qtyMinus.disabled = controlsDisabled;
    qtyPlus.disabled = controlsDisabled;
}

function initializeProductPage() {
    // Quantity selector
    const qtyInput = document.getElementById('qtyInput');
    const qtyMinus = document.getElementById('qtyMinus');
    const qtyPlus = document.getElementById('qtyPlus');

    updateQuantityLimit();

    qtyMinus.addEventListener('click', () => {
        quantity = Math.max(1, quantity - 1);
        qtyInput.value = quantity;
    });

    qtyPlus.addEventListener('click', () => {
        const maxQty = getMaxQuantity(currentProduct) || 1;
        quantity = Math.min(maxQty, quantity + 1);
        qtyInput.value = quantity;
    });

    qtyInput.addEventListener('change', () => {
        const maxQty = getMaxQuantity(currentProduct) || 1;
        quantity = Math.max(1, Math.min(maxQty, parseInt(qtyInput.value) || 1));
        qtyInput.value = quantity;
    });

    // Check stock and disable buttons if out of stock
    const variants = getVariants(currentProduct);
    const stockCount = variants.length > 0
        ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : (currentProduct.stock || 0);
    const isOutOfStock = stockCount === 0;
    const addToCartBtn = document.getElementById('addToCartBtn');
    const buyNowBtn = document.getElementById('buyNowBtn');

    if (isOutOfStock) {
        addToCartBtn.disabled = true;
        addToCartBtn.textContent = 'Нет в наличии';
        addToCartBtn.style.opacity = '0.5';
        addToCartBtn.style.cursor = 'not-allowed';

        buyNowBtn.disabled = true;
        buyNowBtn.textContent = 'Нет в наличии';
        buyNowBtn.style.opacity = '0.5';
        buyNowBtn.style.cursor = 'not-allowed';
    }

    // Add to cart
    addToCartBtn.addEventListener('click', () => {
        if (isOutOfStock) return;

        const selectedVariant = getSelectedVariant(currentProduct);
        if (variants.length > 0) {
            if (!selectedVariant || selectedVariant.stock <= 0) {
                showToast('Нет в наличии для выбранного варианта', 'error');
                return;
            }
            if (quantity > selectedVariant.stock) {
                quantity = selectedVariant.stock;
                qtyInput.value = quantity;
                showToast('Доступно меньшее количество', 'info');
            }
        }

        cart.addItem(currentProduct, quantity, selectedSize, selectedColor, selectedVariant?.id || null);
        showToast('Товар добавлен в корзину', 'success');
    });

    // Buy now
    buyNowBtn.addEventListener('click', () => {
        if (isOutOfStock) return;

        const selectedVariant = getSelectedVariant(currentProduct);
        if (variants.length > 0) {
            if (!selectedVariant || selectedVariant.stock <= 0) {
                showToast('Нет в наличии для выбранного варианта', 'error');
                return;
            }
            if (quantity > selectedVariant.stock) {
                quantity = selectedVariant.stock;
                qtyInput.value = quantity;
                showToast('Доступно меньшее количество', 'info');
            }
        }

        cart.addItem(currentProduct, quantity, selectedSize, selectedColor, selectedVariant?.id || null);
        window.location.href = '/cart';
    });

    // Add to wishlist
    document.getElementById('addToWishlistBtn').addEventListener('click', () => {
        const added = wishlist.toggleItem(currentProduct.id);
        updateWishlistButton();
        showToast(added ? 'Добавлено в избранное' : 'Удалено из избранного', 'success');
    });

    // Accordions
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const isOpen = item.classList.contains('open');

            // Close all
            document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('open'));

            // Toggle current
            if (!isOpen) {
                item.classList.add('open');
            }
        });
    });

    // Open first accordion by default
    document.querySelector('.accordion-item').classList.add('open');
}

function updateWishlistButton() {
    const btn = document.getElementById('addToWishlistBtn');
    const icon = btn.querySelector('i');
    const isInWishlist = wishlist.hasItem(currentProduct.id);

    icon.className = isInWishlist ? 'fas fa-heart' : 'far fa-heart';
    btn.setAttribute('aria-label', isInWishlist ? 'Удалить из избранного' : 'В избранное');
}

function loadRelatedProducts() {
    // Get all products
    const allProducts = typeof getProducts === 'function' ? getProducts() : products;

    // Get products from same category
    const related = allProducts
        .filter(p => p.id !== currentProduct.id && p.category === currentProduct.category)
        .slice(0, 6);

    renderProducts(related, 'relatedProducts');
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

// Lightbox Functions
function initializeLightbox() {
    const lightboxModal = document.getElementById('lightboxModal');
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');

    // Close handlers
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxOverlay.addEventListener('click', closeLightbox);

    // Navigation handlers
    lightboxPrev.addEventListener('click', () => {
        currentLightboxIndex = (currentLightboxIndex - 1 + productImages.length) % productImages.length;
        updateLightboxImage();
    });

    lightboxNext.addEventListener('click', () => {
        currentLightboxIndex = (currentLightboxIndex + 1) % productImages.length;
        updateLightboxImage();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightboxModal.classList.contains('active')) return;

        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowLeft') {
            lightboxPrev.click();
        } else if (e.key === 'ArrowRight') {
            lightboxNext.click();
        }
    });
}

function openLightbox(index) {
    // Получаем актуальный массив изображений (как в renderGallery)
    const product = currentProduct;
    productImages = (Array.isArray(product.images) ? product.images : (product.images ? [product.images] : [product.image || 'https://via.placeholder.com/600']))
        .filter(Boolean)
        .map((url) => getOptimizedImageUrl(url, { width: 1400, quality: 86 }));

    currentLightboxIndex = index;
    const lightboxModal = document.getElementById('lightboxModal');
    lightboxModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateLightboxImage();
}

function closeLightbox() {
    const lightboxModal = document.getElementById('lightboxModal');
    lightboxModal.classList.remove('active');
    document.body.style.overflow = '';
}

function updateLightboxImage() {
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxCounter = document.getElementById('lightboxCounter');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');

    lightboxImage.src = productImages[currentLightboxIndex];
    lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${productImages.length}`;

    // Hide navigation buttons if only one image
    if (productImages.length <= 1) {
        lightboxPrev.style.display = 'none';
        lightboxNext.style.display = 'none';
    } else {
        lightboxPrev.style.display = 'flex';
        lightboxNext.style.display = 'flex';
    }
}
