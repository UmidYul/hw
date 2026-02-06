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

// Initialize hero on page load
async function initHero() {
    await loadBanners();
    renderHeroBanner();
}

// Make functions available globally
if (typeof window !== 'undefined') {
    window.loadBanners = loadBanners;
    window.renderHeroBanner = renderHeroBanner;
    window.initHero = initHero;
}
