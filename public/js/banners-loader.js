// Banners Loader - Dynamic Hero section

let activeBanners = [];

// Load active banners from API
async function loadBanners() {
    try {
        activeBanners = await API.banners.getActive();
        console.log('Banners loaded from API:', activeBanners.length);
        return activeBanners;
    } catch (error) {
        console.error('Failed to load banners from API:', error);
        return [];
    }
}

// Render hero banner
function renderHeroBanner() {
    const heroSection = document.querySelector('.hero');
    if (!heroSection) return;

    const heroBanners = activeBanners.filter(b => b.placement === 'home_hero');

    if (heroBanners.length === 0) {
        // Keep default static hero
        heroSection.classList.remove('banner-active');
        return;
    }

    // Use first active hero banner
    const banner = heroBanners[0];

    // Update hero content
    heroSection.style.backgroundColor = banner.background_color || '#F5F5F5';
    heroSection.style.color = '#ffffff';
    heroSection.classList.add('banner-active');

    if (banner.image) {
        heroSection.style.backgroundImage = `url(${banner.image})`;
        heroSection.style.backgroundSize = 'cover';
        heroSection.style.backgroundPosition = 'center';
    }

    const heroContent = heroSection.querySelector('.hero-content');
    if (heroContent) {
        let html = '';

        if (banner.subtitle) {
            html += `<span class="hero-subtitle">${banner.subtitle}</span>`;
        }

        html += `<h1 class="hero-title">${banner.title}</h1>`;

        if (banner.description) {
            html += `<p class="hero-text">${banner.description}</p>`;
        }

        if (banner.button_text && banner.button_link) {
            html += `<a href="${banner.button_link}" class="btn btn-primary">${banner.button_text}</a>`;
        }

        heroContent.innerHTML = html;
    }
}

// Render multiple hero banners as slider (for future)
function renderHeroSlider() {
    const heroSection = document.querySelector('.hero');
    if (!heroSection) return;

    const heroBanners = activeBanners.filter(b => b.placement === 'home_hero');

    if (heroBanners.length <= 1) {
        renderHeroBanner();
        return;
    }

    // TODO: Implement slider for multiple banners
    // For now, just show the first one
    renderHeroBanner();
}

// Render home strip banner (narrow band on homepage)
function renderStripBanner() {
    const stripSection = document.querySelector('.home-strip');
    if (!stripSection) return;

    const stripBanners = activeBanners.filter(b => b.placement === 'home_strip');
    if (stripBanners.length === 0) {
        stripSection.style.display = 'none';
        return;
    }

    const banner = stripBanners[0];
    stripSection.style.display = '';
    const imageStyle = banner.image ? `background-image: url(${banner.image}); background-size: cover; background-position: center;` : '';

    stripSection.innerHTML = `
        <div class="home-strip-inner" style="${imageStyle}; background-color: ${banner.background_color || '#FAFAFA'}; color: ${banner.text_color || '#2D2D2D'}; padding: 24px 0;">
            <div class="container">
                <div class="strip-content">
                    ${banner.subtitle ? `<div class="strip-subtitle">${banner.subtitle}</div>` : ''}
                    <h2 class="strip-title">${banner.title}</h2>
                    ${banner.button_text && banner.button_link ? `<a href="${banner.button_link}" class="btn btn-primary">${banner.button_text}</a>` : ''}
                </div>
            </div>
        </div>
    `;
}

// Render catalog-top banner
function renderCatalogTop() {
    const container = document.querySelector('.catalog-top');
    if (!container) return;

    const banners = activeBanners.filter(b => b.placement === 'catalog_top');
    if (banners.length === 0) {
        container.style.display = 'none';
        return;
    }

    const banner = banners[0];
    container.style.display = '';
    const imageStyle = banner.image ? `background-image: url(${banner.image}); background-size: cover; background-position: center;` : '';

    container.innerHTML = `
        <div class="catalog-top-inner" style="${imageStyle}; background-color: ${banner.background_color || '#FFF'}; color: ${banner.text_color || '#2D2D2D'}; padding: 20px 0;">
            <div class="container">
                <div class="catalog-top-content">
                    ${banner.subtitle ? `<div class="catalog-subtitle">${banner.subtitle}</div>` : ''}
                    <h3 class="catalog-title">${banner.title}</h3>
                    ${banner.description ? `<p class="catalog-desc">${banner.description}</p>` : ''}
                    ${banner.button_text && banner.button_link ? `<a href="${banner.button_link}" class="btn btn-primary">${banner.button_text}</a>` : ''}
                </div>
            </div>
        </div>
    `;
}

// Render collection-page banner
function renderCollectionBanner() {
    const container = document.querySelector('.collection-banner');
    if (!container) return;

    const banners = activeBanners.filter(b => b.placement === 'collection_page');
    if (banners.length === 0) {
        container.style.display = 'none';
        return;
    }

    const banner = banners[0];
    container.style.display = '';
    const imageStyle = banner.image ? `background-image: url(${banner.image}); background-size: cover; background-position: center;` : '';

    container.innerHTML = `
        <div class="collection-banner-inner" style="${imageStyle}; background-color: ${banner.background_color || '#FFF'}; color: ${banner.text_color || '#2D2D2D'}; padding: 24px 0;">
            <div class="container">
                <div class="collection-banner-content">
                    ${banner.subtitle ? `<div class="collection-banner-subtitle">${banner.subtitle}</div>` : ''}
                    <h3 class="collection-banner-title">${banner.title}</h3>
                    ${banner.description ? `<p class="collection-banner-desc">${banner.description}</p>` : ''}
                    ${banner.button_text && banner.button_link ? `<a href="${banner.button_link}" class="btn btn-primary">${banner.button_text}</a>` : ''}
                </div>
            </div>
        </div>
    `;
}

// Get banners by placement (helper)
function getBannersByPlacement(placement) {
    return activeBanners.filter(b => b.placement === placement);
}

// Initialize hero on page load
async function initHero() {
    await loadBanners();
    renderHeroBanner();
    renderStripBanner();
}

// Make functions available globally
if (typeof window !== 'undefined') {
    window.loadBanners = loadBanners;
    window.renderHeroBanner = renderHeroBanner;
    window.initHero = initHero;
    window.renderStripBanner = renderStripBanner;
    window.renderCatalogTop = renderCatalogTop;
    window.renderCollectionBanner = renderCollectionBanner;
    window.getBannersByPlacement = getBannersByPlacement;
}
