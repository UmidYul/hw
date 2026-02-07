// Product Page Logic

let currentProduct = null;
let selectedColor = null;
let selectedSize = null;
let quantity = 1;
let currentLightboxIndex = 0;
let productImages = [];
const BASE_URL = 'https://higherwaist.uz';

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

document.addEventListener('DOMContentLoaded', async () => {
    // Load products from API
    await loadProducts();

    const productId = parseInt(getUrlParam('id'));

    if (!productId) {
        window.location.href = 'catalog.html';
        return;
    }

    currentProduct = typeof getProductById === 'function' ? getProductById(productId) : products.find(p => p.id === productId);

    if (!currentProduct) {
        window.location.href = 'catalog.html';
        return;
    }

    // Add to recently viewed
    recentlyViewed.add(productId);

    // Render product
    renderProduct();

    // Initialize interactions
    initializeProductPage();

    // Initialize lightbox
    initializeLightbox();

    // Load related products
    loadRelatedProducts();
});

function renderProduct() {
    const product = currentProduct;

    // Update breadcrumbs
    document.getElementById('productCategoryLink').href = `catalog.html?category=${product.category}`;
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

    // Rating
    const reviewsCount = product.reviewsCount || product.reviews_count || 0;
    document.getElementById('productRating').innerHTML = generateStars(product.rating);
    document.getElementById('productRatingText').textContent = `${product.rating} (${reviewsCount} отзывов)`;

    // Price
    document.getElementById('productPrice').textContent = formatPrice(finalPrice);
    if (originalPrice && originalPrice > finalPrice) {
        document.getElementById('productOldPrice').textContent = formatPrice(originalPrice);
    } else {
        document.getElementById('productOldPrice').style.display = 'none';
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
    document.getElementById('accordionDelivery').innerHTML = `<div class="accordion-content-inner"><p>${product.deliveryInfo || product.delivery_info || 'Доставка 3-5 дней'}</p></div>`;

    // Check if in wishlist
    updateWishlistButton();
}

function renderGallery() {
    const product = currentProduct;
    const galleryMain = document.getElementById('galleryMain');
    const galleryThumbs = document.getElementById('galleryThumbs');

    // Get images - handle both array and single image
    productImages = Array.isArray(product.images) ? product.images : (product.images ? [product.images] : [product.image || 'https://via.placeholder.com/600']);

    // Main image
    const mainImage = productImages[0];
    galleryMain.innerHTML = `
        <div class="gallery-image" style="background-image: url('${mainImage}'); background-size: cover; background-position: center; cursor: zoom-in;" data-index="0"></div>
    `;

    // Add click to open lightbox
    galleryMain.querySelector('.gallery-image').addEventListener('click', () => {
        openLightbox(0);
    });

    // Always show thumbnails if there are images
    galleryThumbs.innerHTML = productImages.map((img, index) => `
        <div class="gallery-thumb ${index === 0 ? 'active' : ''}" data-index="${index}" style="background-image: url('${img}'); background-size: cover; background-position: center;"></div>
    `).join('');

    // Thumb click handler
    galleryThumbs.querySelectorAll('.gallery-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
            galleryThumbs.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');

            const index = parseInt(thumb.dataset.index);
            const img = productImages[index];
            galleryMain.innerHTML = `
                <div class="gallery-image" style="background-image: url('${img}'); background-size: cover; background-position: center; cursor: zoom-in;" data-index="${index}"></div>
            `;

            // Re-add click handler
            galleryMain.querySelector('.gallery-image').addEventListener('click', () => {
                openLightbox(index);
            });
        });
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
