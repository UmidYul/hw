import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = String(process.env.BASE_URL || '').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10);
const RUN_MUTATION_TESTS = process.env.RUN_MUTATION_TESTS === 'true';
const ADMIN_USER = String(process.env.SMOKE_ADMIN_USER || process.env.ADMIN_USER || '').trim();
const ADMIN_PASS = String(process.env.SMOKE_ADMIN_PASS || process.env.ADMIN_PASS || '').trim();
const ADMIN_2FA_CODE = String(process.env.SMOKE_ADMIN_2FA_CODE || '').trim();

if (!BASE_URL) {
    throw new Error('BASE_URL is required. Example: BASE_URL=https://your-domain.com');
}

const maybeToJson = async (response) => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return response.json();
    }
    return response.text();
};

const splitSetCookieHeader = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return String(value).split(/,(?=\s*[^=;,\s]+=[^;]+)/g);
};

class HttpClient {
    constructor(name) {
        this.name = name;
        this.cookies = new Map();
    }

    getCookie(name) {
        return this.cookies.get(name) || null;
    }

    buildCookieHeader() {
        const pairs = Array.from(this.cookies.entries()).map(([key, value]) => `${key}=${value}`);
        return pairs.join('; ');
    }

    storeCookies(response) {
        const rawSetCookie = typeof response.headers.getSetCookie === 'function'
            ? response.headers.getSetCookie()
            : splitSetCookieHeader(response.headers.get('set-cookie'));

        rawSetCookie.forEach((cookieLine) => {
            const [nameValue] = String(cookieLine || '').split(';');
            const eqIndex = nameValue.indexOf('=');
            if (eqIndex <= 0) return;
            const name = nameValue.slice(0, eqIndex).trim();
            const value = nameValue.slice(eqIndex + 1).trim();
            if (!name) return;
            this.cookies.set(name, value);
        });
    }

    async request(path, options = {}) {
        const {
            method = 'GET',
            json,
            headers = {},
            allowStatuses = [200]
        } = options;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

        const requestHeaders = { ...headers };
        const cookieHeader = this.buildCookieHeader();
        if (cookieHeader) {
            requestHeaders.Cookie = cookieHeader;
        }
        if (json !== undefined) {
            requestHeaders['Content-Type'] = 'application/json';
        }
        if (method !== 'GET' && method !== 'HEAD') {
            const csrfToken = this.getCookie('csrfToken');
            if (csrfToken && !requestHeaders['X-CSRF-Token'] && !requestHeaders['x-csrf-token']) {
                requestHeaders['X-CSRF-Token'] = csrfToken;
            }
        }

        try {
            const response = await fetch(url, {
                method,
                headers: requestHeaders,
                body: json !== undefined ? JSON.stringify(json) : undefined,
                signal: controller.signal
            });
            this.storeCookies(response);
            const payload = await maybeToJson(response);

            if (!allowStatuses.includes(response.status)) {
                const bodyPreview = typeof payload === 'string'
                    ? payload.slice(0, 240)
                    : JSON.stringify(payload).slice(0, 240);
                throw new Error(
                    `[${this.name}] ${method} ${path} -> ${response.status}. Body: ${bodyPreview}`
                );
            }

            return {
                status: response.status,
                ok: response.ok,
                body: payload,
                headers: response.headers
            };
        } finally {
            clearTimeout(timeout);
        }
    }
}

const publicClient = new HttpClient('public');
const adminClient = new HttpClient('admin');
const state = {
    product: null,
    orderId: null
};

const requiredArray = (value, message) => {
    assert.ok(Array.isArray(value), message);
    return value;
};

const pickOrderItem = (product) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const variant = variants.find((entry) => Number(entry?.stock) > 0);

    if (variant) {
        return {
            productId: String(product.id),
            variantId: String(variant.id),
            quantity: 1,
            color: variant.color || null,
            size: variant.size || null
        };
    }

    const productStock = Number(product?.stock || 0);
    if (productStock > 0) {
        return {
            productId: String(product.id),
            quantity: 1
        };
    }

    return null;
};

test('Production smoke suite', async (t) => {
    await t.test('Public pages are reachable', async () => {
        const routes = [
            '/',
            '/catalog',
            '/product',
            '/cart',
            '/delivery',
            '/payment',
            '/returns',
            '/faq',
            '/privacy',
            '/terms',
            '/contacts',
            '/about'
        ];

        for (const route of routes) {
            const response = await publicClient.request(route, { allowStatuses: [200] });
            assert.equal(typeof response.body, 'string', `Expected HTML for ${route}`);
            assert.match(response.body, /<html/i, `Expected html markup for ${route}`);
        }
    });

    await t.test('Core public API endpoints respond with expected shape', async () => {
        const health = await publicClient.request('/api/health');
        assert.equal(health.body?.status, 'ok', 'Health status must be ok');

        const settings = await publicClient.request('/api/settings');
        assert.equal(typeof settings.body, 'object', 'Settings payload must be an object');

        const categories = await publicClient.request('/api/categories/visible');
        requiredArray(categories.body, 'Categories must be an array');

        const discounts = await publicClient.request('/api/discounts/active');
        requiredArray(discounts.body, 'Active discounts must be an array');

        const banners = await publicClient.request('/api/banners/active');
        requiredArray(banners.body, 'Active banners must be an array');
    });

    await t.test('Products API supports listing, detail, search, and filters', async () => {
        const productsResponse = await publicClient.request('/api/products');
        const products = requiredArray(productsResponse.body, 'Products list must be an array');
        assert.ok(products.length > 0, 'Products list must not be empty');

        const firstProduct = products[0];
        assert.ok(firstProduct?.id, 'Product id is required');
        state.product = firstProduct;

        const productDetail = await publicClient.request(`/api/products/${firstProduct.id}`);
        assert.equal(String(productDetail.body?.id), String(firstProduct.id), 'Product detail id mismatch');
        assert.ok(productDetail.body?.title, 'Product title is required');

        if (firstProduct.category) {
            const categoryProducts = await publicClient.request(`/api/products?category=${encodeURIComponent(firstProduct.category)}`);
            const filtered = requiredArray(categoryProducts.body, 'Filtered products must be an array');
            assert.ok(filtered.every((item) => item.category === firstProduct.category), 'Category filter returned mismatched items');
        }

        const searchToken = String(firstProduct.title || '').trim().split(/\s+/)[0] || '';
        if (searchToken.length >= 3) {
            const searchProducts = await publicClient.request(`/api/products?search=${encodeURIComponent(searchToken)}`);
            const list = requiredArray(searchProducts.body, 'Search results must be an array');
            assert.ok(
                list.some((item) => String(item.title || '').toLowerCase().includes(searchToken.toLowerCase())),
                'Search did not return matching products'
            );
        }
    });

    await t.test('Promocode validation handles invalid and missing input safely', async () => {
        const missingCode = await publicClient.request('/api/promocodes/validate', {
            method: 'POST',
            json: { amount: 100000 },
            allowStatuses: [400]
        });
        assert.equal(missingCode.body?.valid, false, 'Missing code must return valid=false');

        const invalidCode = await publicClient.request('/api/promocodes/validate', {
            method: 'POST',
            json: { code: 'NOT-A-REAL-CODE', amount: 100000 },
            allowStatuses: [404, 200]
        });
        if (invalidCode.status === 200) {
            assert.equal(invalidCode.body?.valid, false, 'Invalid code should not be valid');
        }
    });

    await t.test('Protected endpoints reject unauthenticated access', async () => {
        const unauthorizedOrders = await publicClient.request('/api/orders', { allowStatuses: [401, 403] });
        assert.ok([401, 403].includes(unauthorizedOrders.status), 'Orders endpoint must be protected');
    });

    await t.test('Optional mutation test: checkout flow creates an order', async (subt) => {
        if (!RUN_MUTATION_TESTS) {
            subt.skip('RUN_MUTATION_TESTS is false. Skipping data-changing checks.');
            return;
        }

        if (!state.product?.id) {
            throw new Error('No product selected from previous test');
        }

        const freshProduct = await publicClient.request(`/api/products/${state.product.id}`);
        const orderItem = pickOrderItem(freshProduct.body);
        if (!orderItem) {
            subt.skip('Selected product has no available stock for checkout test.');
            return;
        }

        const uniqueSuffix = Date.now().toString().slice(-8);
        const phone = `+99890${uniqueSuffix}`;
        const orderPayload = {
            customerName: `Smoke Test ${uniqueSuffix}`,
            customerPhone: phone,
            customerEmail: `smoke-${uniqueSuffix}@example.test`,
            shippingAddress: {
                city: 'Tashkent',
                address: 'Smoke street, 1',
                country: 'Uzbekistan',
                postalCode: '100000',
                phone
            },
            paymentMethod: 'card',
            notes: 'Automated production smoke test order',
            items: [orderItem]
        };

        const created = await publicClient.request('/api/orders', {
            method: 'POST',
            json: orderPayload,
            allowStatuses: [201]
        });

        assert.ok(created.body?.id, 'Order id must be returned');
        assert.ok(created.body?.orderNumber, 'Order number must be returned');
        state.orderId = created.body.id;

        const productAfter = await publicClient.request(`/api/products/${state.product.id}`);
        assert.ok(Number(productAfter.body?.stock) >= 0, 'Stock must never be negative');
    });

    await t.test('Optional admin smoke: login and protected reads', async (subt) => {
        if (!ADMIN_USER || !ADMIN_PASS) {
            subt.skip('SMOKE_ADMIN_USER/SMOKE_ADMIN_PASS are not set.');
            return;
        }

        const login = await adminClient.request('/api/auth/login', {
            method: 'POST',
            json: { username: ADMIN_USER, password: ADMIN_PASS },
            allowStatuses: [200]
        });

        if (login.body?.requires2fa) {
            if (!ADMIN_2FA_CODE) {
                subt.skip('2FA is enabled and SMOKE_ADMIN_2FA_CODE is not provided.');
                return;
            }

            await adminClient.request('/api/auth/2fa/verify-login', {
                method: 'POST',
                json: {
                    challengeId: login.body.challengeId,
                    code: ADMIN_2FA_CODE
                },
                allowStatuses: [200]
            });
        }

        const orders = await adminClient.request('/api/orders?limit=5');
        requiredArray(orders.body, 'Admin orders payload must be an array');

        const promocodes = await adminClient.request('/api/promocodes');
        requiredArray(promocodes.body, 'Admin promocodes payload must be an array');

        if (RUN_MUTATION_TESTS && state.orderId) {
            await adminClient.request('/admin/login', { allowStatuses: [200] });
            assert.ok(adminClient.getCookie('csrfToken'), 'CSRF cookie is required for admin mutation request');

            await adminClient.request(`/api/orders/${state.orderId}/status`, {
                method: 'PATCH',
                json: { status: 'processing' },
                allowStatuses: [200]
            });

            await adminClient.request(`/api/orders/${state.orderId}/status`, {
                method: 'PATCH',
                json: { status: 'pending' },
                allowStatuses: [200]
            });
        }
    });
});
