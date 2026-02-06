const loadPartial = async (elementId, url) => {
    const container = document.getElementById(elementId);
    if (!container) return;

    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
        console.error(`Failed to load ${url}: ${response.status}`);
        return;
    }

    container.innerHTML = await response.text();
};

window.layoutReady = Promise.all([
    loadPartial('siteHeader', '/partials/header.html'),
    loadPartial('siteFooter', '/partials/footer.html')
]);
