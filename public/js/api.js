// API Client for Higher Waist E-commerce
// Replaces LocalStorage with real backend API calls

if (typeof API_BASE_URL === 'undefined') {
    var API_BASE_URL = '/api';
}

// Helper function for API calls
function getCookie(name) {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : '';
}

function getCsrfToken() {
    return getCookie('csrfToken');
}

async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const csrfToken = getCsrfToken();

    try {
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call failed:', endpoint, error);
        throw error;
    }
}

// Products API
const productsAPI = {
    async getAll(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/products?${queryString}` : '/products';
        return await apiCall(endpoint);
    },

    async getById(id) {
        return await apiCall(`/products/${id}`);
    },

    async create(productData) {
        return await apiCall('/products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });
    },

    async update(id, productData) {
        return await apiCall(`/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(productData)
        });
    },

    async delete(id) {
        return await apiCall(`/products/${id}`, {
            method: 'DELETE'
        });
    }
};

// Orders API
const ordersAPI = {
    async getAll(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/orders?${queryString}` : '/orders';
        return await apiCall(endpoint);
    },

    async getById(id) {
        return await apiCall(`/orders/${id}`);
    },

    async create(orderData) {
        return await apiCall('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    },

    async updateStatus(id, status) {
        return await apiCall(`/orders/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    },

    async delete(id) {
        return await apiCall(`/orders/${id}`, {
            method: 'DELETE'
        });
    }
};

// Auth API
const authAPI = {
    async changePassword(currentPassword, newPassword, confirmPassword) {
        const csrfToken = getCsrfToken();
        const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.message || `HTTP error! status: ${response.status}`);
        }

        return payload;
    },

    async getTwoFactorSettings() {
        const csrfToken = getCsrfToken();
        const response = await fetch(`${API_BASE_URL}/auth/2fa`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.message || `HTTP error! status: ${response.status}`);
        }

        return payload;
    },

    async sendTwoFactorSetupCode(email) {
        const csrfToken = getCsrfToken();
        const response = await fetch(`${API_BASE_URL}/auth/2fa/send-setup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ email })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.message || `HTTP error! status: ${response.status}`);
        }

        return payload;
    },

    async confirmTwoFactorSetup(challengeId, code) {
        const csrfToken = getCsrfToken();
        const response = await fetch(`${API_BASE_URL}/auth/2fa/confirm-setup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ challengeId, code })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.message || `HTTP error! status: ${response.status}`);
        }

        return payload;
    },

    async disableTwoFactor() {
        const csrfToken = getCsrfToken();
        const response = await fetch(`${API_BASE_URL}/auth/2fa/disable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
            },
            credentials: 'include'
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.message || `HTTP error! status: ${response.status}`);
        }

        return payload;
    }
};

// Customers API
const customersAPI = {
    async getAll() {
        return await apiCall('/customers');
    },

    async getById(id) {
        return await apiCall(`/customers/${id}`);
    },

    async create(customerData) {
        return await apiCall('/customers', {
            method: 'POST',
            body: JSON.stringify(customerData)
        });
    },

    async update(id, customerData) {
        return await apiCall(`/customers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(customerData)
        });
    },

    async delete(id) {
        return await apiCall(`/customers/${id}`, {
            method: 'DELETE'
        });
    }
};

// Banners API
const bannersAPI = {
    async getAll(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/banners?${queryString}` : '/banners';
        return await apiCall(endpoint);
    },

    async getActive() {
        return await apiCall('/banners/active');
    },

    async getById(id) {
        return await apiCall(`/banners/${id}`);
    },

    async create(bannerData) {
        return await apiCall('/banners', {
            method: 'POST',
            body: JSON.stringify(bannerData)
        });
    },

    async update(id, bannerData) {
        return await apiCall(`/banners/${id}`, {
            method: 'PUT',
            body: JSON.stringify(bannerData)
        });
    },

    async delete(id) {
        return await apiCall(`/banners/${id}`, {
            method: 'DELETE'
        });
    }
};

// Collections API
const collectionsAPI = {
    async getAll(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/collections?${queryString}` : '/collections';
        return await apiCall(endpoint);
    },

    async getBySlug(slug) {
        return await apiCall(`/collections/slug/${slug}`);
    },

    async getById(id) {
        return await apiCall(`/collections/${id}`);
    },

    async create(collectionData) {
        return await apiCall('/collections', {
            method: 'POST',
            body: JSON.stringify(collectionData)
        });
    },

    async update(id, collectionData) {
        return await apiCall(`/collections/${id}`, {
            method: 'PUT',
            body: JSON.stringify(collectionData)
        });
    },

    async delete(id) {
        return await apiCall(`/collections/${id}`, {
            method: 'DELETE'
        });
    }
};

// Categories API
const categoriesAPI = {
    async getAll() {
        return await apiCall('/categories');
    },

    async getById(id) {
        return await apiCall(`/categories/${id}`);
    },

    async getVisible() {
        return await apiCall('/categories/visible');
    },

    async create(categoryData) {
        return await apiCall('/categories', {
            method: 'POST',
            body: JSON.stringify(categoryData)
        });
    },

    async update(id, categoryData) {
        return await apiCall(`/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify(categoryData)
        });
    },

    async delete(id) {
        return await apiCall(`/categories/${id}`, {
            method: 'DELETE'
        });
    }
};

// Promocodes API
const promocodesAPI = {
    async getAll() {
        return await apiCall('/promocodes');
    },

    async getById(id) {
        return await apiCall(`/promocodes/${id}`);
    },

    async validate(code, amount) {
        return await apiCall('/promocodes/validate', {
            method: 'POST',
            body: JSON.stringify({ code, amount })
        });
    },

    async create(promocodeData) {
        return await apiCall('/promocodes', {
            method: 'POST',
            body: JSON.stringify(promocodeData)
        });
    },

    async update(id, promocodeData) {
        return await apiCall(`/promocodes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(promocodeData)
        });
    },

    async delete(id) {
        return await apiCall(`/promocodes/${id}`, {
            method: 'DELETE'
        });
    },

    async getStats(id) {
        return await apiCall(`/promocodes/${id}/stats`);
    },

    async recordUsage(code, customerPhone, orderId) {
        return await apiCall('/promocodes/record-usage', {
            method: 'POST',
            body: JSON.stringify({ code, customerPhone, orderId })
        });
    }
};

// Discounts API
const discountsAPI = {
    async getAll() {
        return await apiCall('/discounts');
    },

    async getActive() {
        return await apiCall('/discounts/active');
    },

    async getById(id) {
        return await apiCall(`/discounts/${id}`);
    },

    async create(discountData) {
        return await apiCall('/discounts', {
            method: 'POST',
            body: JSON.stringify(discountData)
        });
    },

    async update(id, discountData) {
        return await apiCall(`/discounts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(discountData)
        });
    },

    async delete(id) {
        return await apiCall(`/discounts/${id}`, {
            method: 'DELETE'
        });
    }
};

// Content Settings API
const contentAPI = {
    async getAll() {
        return await apiCall('/content');
    },

    async getByKey(key) {
        return await apiCall(`/content/${key}`);
    },

    async update(key, value) {
        return await apiCall(`/content/${key}`, {
            method: 'PUT',
            body: JSON.stringify({ value })
        });
    },

    async getInfoPages() {
        return await apiCall('/content/pages');
    },

    async getInfoPage(slug) {
        return await apiCall(`/content/pages/${slug}`);
    },

    async updateInfoPage(slug, payload) {
        return await apiCall(`/content/pages/${slug}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }
};

// Settings API
const settingsAPI = {
    async get() {
        return await apiCall('/settings');
    },

    async update(settings) {
        return await apiCall('/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }
};

// Stats API
const statsAPI = {
    async getDashboard(period = '30') {
        return await apiCall(`/stats/dashboard?period=${period}`);
    }
};

// Newsletters API
const newslettersAPI = {
    async getAll() {
        return await apiCall('/newsletters');
    },

    async getById(id) {
        return await apiCall(`/newsletters/${id}`);
    },

    async create(payload) {
        return await apiCall('/newsletters', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async update(id, payload) {
        return await apiCall(`/newsletters/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    },

    async delete(id) {
        return await apiCall(`/newsletters/${id}`, {
            method: 'DELETE'
        });
    },

    async send(id, payload = null) {
        const hasForce = payload && payload.force === true;
        const endpoint = hasForce ? `/newsletters/${id}/send?force=1` : `/newsletters/${id}/send`;
        return await apiCall(endpoint, {
            method: 'POST',
            body: payload ? JSON.stringify(payload) : undefined
        });
    }
};

// Subscribers API
const subscribersAPI = {
    async subscribe(email, source = 'website') {
        return await apiCall('/subscribers', {
            method: 'POST',
            body: JSON.stringify({ email, source })
        });
    }
};

// Export unified API object
const API = {
    products: productsAPI,
    orders: ordersAPI,
    customers: customersAPI,
    banners: bannersAPI,
    collections: collectionsAPI,
    categories: categoriesAPI,
    promocodes: promocodesAPI,
    discounts: discountsAPI,
    content: contentAPI,
    settings: settingsAPI,
    stats: statsAPI,
    newsletters: newslettersAPI,
    subscribers: subscribersAPI,
    auth: authAPI,
    getCsrfToken
};

// Make API available globally
if (typeof window !== 'undefined') {
    if (window.API && typeof window.API === 'object') {
        window.API = { ...window.API, ...API };
    } else {
        window.API = API;
    }

    if (typeof window.API.getCsrfToken !== 'function') {
        window.API.getCsrfToken = getCsrfToken;
    }
}
