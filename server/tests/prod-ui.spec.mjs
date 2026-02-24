import { test, expect } from '@playwright/test';

const waitForCatalogProducts = async (page) => {
    await page.goto('/catalog', { waitUntil: 'domcontentloaded' });
    await expect
        .poll(async () => page.locator('#catalogProducts .product-card').count(), { timeout: 30000 })
        .toBeGreaterThan(0);
};

test.describe('Production UI smoke', () => {
    test('Quick view shows image and closes from icon click', async ({ page }) => {
        await waitForCatalogProducts(page);

        await page.locator('#catalogProducts .product-card .quick-view').first().click();

        const modal = page.locator('#quickViewModal');
        await expect(modal).toHaveClass(/open/);
        await expect(page.locator('#quickViewBody .quick-view-image img')).toBeVisible();

        await page.locator('#quickViewClose i').click();
        await expect(modal).not.toHaveClass(/open/);
    });

    test('Size and color filters reduce list to matching products', async ({ page }) => {
        await waitForCatalogProducts(page);

        await page.locator('#resetFilters').click();
        const beforeSizeCount = await page.evaluate(() => window.filteredProducts?.length ?? 0);

        const selectedSize = 'M';
        await page.locator(`#sizeFilter .filter-chip[data-value="${selectedSize}"]`).click();
        await page.waitForTimeout(200);

        const afterSizeCount = await page.evaluate(() => window.filteredProducts?.length ?? 0);
        expect(afterSizeCount).toBeLessThanOrEqual(beforeSizeCount);

        const sizeFilterMatches = await page.evaluate((size) => {
            if (!Array.isArray(window.filteredProducts)) return false;
            if (typeof getAvailableSizesForProduct !== 'function') return false;
            return window.filteredProducts.every((product) => {
                const sizes = getAvailableSizesForProduct(product);
                return sizes.includes(size);
            });
        }, selectedSize);
        expect(sizeFilterMatches).toBeTruthy();

        await page.locator('#resetFilters').click();
        await page.waitForTimeout(200);

        const colorSwatch = page.locator('#colorFilter .color-swatch').first();
        const colorRaw = await colorSwatch.getAttribute('data-color');
        expect(colorRaw).toBeTruthy();

        const beforeColorCount = await page.evaluate(() => window.filteredProducts?.length ?? 0);
        await colorSwatch.click();
        await page.waitForTimeout(200);

        const afterColorCount = await page.evaluate(() => window.filteredProducts?.length ?? 0);
        expect(afterColorCount).toBeLessThanOrEqual(beforeColorCount);

        const colorFilterMatches = await page.evaluate((rawColor) => {
            if (!Array.isArray(window.filteredProducts)) return false;
            if (typeof getAvailableColorsForProduct !== 'function' || typeof normalizeColorValue !== 'function') return false;
            const expected = normalizeColorValue(rawColor);
            return window.filteredProducts.every((product) => {
                const colors = getAvailableColorsForProduct(product);
                return colors.includes(expected);
            });
        }, colorRaw);
        expect(colorFilterMatches).toBeTruthy();
    });

    test('Product page has separated title/price and non-empty delivery text', async ({ page }) => {
        await waitForCatalogProducts(page);

        const link = await page.locator('#catalogProducts .product-card .product-card-title').first().getAttribute('href');
        expect(link).toBeTruthy();

        await page.goto(link, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.product-title')).toBeVisible();
        await expect(page.locator('.product-info .product-price .price-current')).toBeVisible();

        const typography = await page.evaluate(() => {
            const title = document.querySelector('.product-title');
            const price = document.querySelector('.product-info .product-price .price-current');
            if (!title || !price) return null;
            return {
                titleSize: Number.parseFloat(getComputedStyle(title).fontSize || '0'),
                priceSize: Number.parseFloat(getComputedStyle(price).fontSize || '0')
            };
        });

        expect(typography).toBeTruthy();
        expect(typography.priceSize).toBeGreaterThan(0);
        expect(typography.titleSize).toBeGreaterThan(0);
        expect(typography.priceSize).toBeGreaterThanOrEqual(typography.titleSize * 0.9);

        const deliveryText = (await page.locator('#accordionDelivery').innerText()).trim();
        expect(deliveryText.length).toBeGreaterThan(0);
    });
});

