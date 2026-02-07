// Products Loader - Load products from API instead of data.js
// This replaces the static products array

window.products = window.products || [];
let productsLoaded = false;

// Load products from API
async function loadProducts() {
    if (productsLoaded) {
        return window.products;
    }

    try {
        window.products = await API.products.getAll();
        productsLoaded = true;
        console.log('Products loaded from API:', window.products.length);

        // Apply discounts if discount system is available
        if (window.discountSystem) {
            if (!window.discountSystem.loaded) {
                await window.discountSystem.loadActiveDiscounts();
            }
            window.products = window.discountSystem.applyDiscountsToProducts(window.products);
            console.log('Discounts applied to products');
        }

        return window.products;
    } catch (error) {
        console.error('Failed to load products from API, using fallback:', error);
        // Fallback to data.js if API fails
        if (typeof window.productsFromDataJS !== 'undefined') {
            window.products = window.productsFromDataJS;
            productsLoaded = true;
        }
        return window.products;
    }
}

// Reload products with discounts applied
async function reloadProductsWithDiscounts() {
    if (window.discountSystem) {
        await window.discountSystem.loadActiveDiscounts();
        window.products = window.discountSystem.applyDiscountsToProducts(window.products);
    }
    return window.products;
}

// Get all products
function getProducts() {
    return window.products;
}

// Get product by ID
function getProductById(id) {
    const target = String(id);
    return window.products.find(p => String(p.id) === target);
}

// Get products by category
function getProductsByCategory(category) {
    if (category === 'all') return window.products;
    return window.products.filter(p => p.category === category);
}

// Get products by tag
function getProductsByTag(tag) {
    return window.products.filter(p => p.tags && p.tags.includes(tag));
}

// Search products
function searchProducts(query) {
    const lowerQuery = query.toLowerCase();
    return window.products.filter(p =>
        p.title.toLowerCase().includes(lowerQuery) ||
        (p.description && p.description.toLowerCase().includes(lowerQuery))
    );
}

// Make functions available globally
if (typeof window !== 'undefined') {
    window.loadProducts = loadProducts;
    window.reloadProductsWithDiscounts = reloadProductsWithDiscounts;
    window.getProducts = getProducts;
    window.getProductById = getProductById;
    window.getProductsByCategory = getProductsByCategory;
    window.getProductsByTag = getProductsByTag;
    window.searchProducts = searchProducts;
}
