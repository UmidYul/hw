import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbAll, dbGet, dbRun } from '../database/db.js';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productDir = path.join(__dirname, '../../public/images/products');

const isLocalProductImage = (url) => typeof url === 'string' && url.startsWith('/images/products/');

const getProductImagePath = (url) => {
    if (!isLocalProductImage(url)) return null;
    return path.join(productDir, path.basename(url));
};

const isProductImageUsedElsewhere = async (url, excludeId) => {
    if (!isLocalProductImage(url)) return false;
    const jsonValue = JSON.stringify([url]);
    if (excludeId) {
        const row = await dbGet('SELECT id FROM products WHERE id <> ? AND images @> ?::jsonb LIMIT 1', [excludeId, jsonValue]);
        return !!row;
    }
    const row = await dbGet('SELECT id FROM products WHERE images @> ?::jsonb LIMIT 1', [jsonValue]);
    return !!row;
};

const safeDeleteProductImage = async (url, excludeId) => {
    const filePath = getProductImagePath(url);
    if (!filePath) return;
    if (await isProductImageUsedElsewhere(url, excludeId)) return;
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.warn('Failed to delete product image:', error.message);
    }
};

const parseJsonField = (value, fallback) => {
    if (value === null || value === undefined) return fallback;
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
};

function normalizeVariants(variants) {
    if (!Array.isArray(variants)) return [];
    return variants
        .filter(v => v && v.color && v.size)
        .map(v => ({
            color: String(v.color).trim(),
            size: String(v.size).trim(),
            stock: Math.max(0, parseInt(v.stock) || 0)
        }));
}

async function loadVariantsForProducts(productIds) {
    if (!productIds.length) return {};

    const placeholders = productIds.map(() => '?').join(',');
    const rows = await dbAll(
        `SELECT id, product_id, color, size, stock FROM product_variants WHERE product_id IN (${placeholders})`,
        productIds
    );

    const map = {};
    rows.forEach(row => {
        if (!map[row.product_id]) map[row.product_id] = [];
        map[row.product_id].push({
            id: row.id,
            productId: row.product_id,
            color: row.color,
            size: row.size,
            stock: row.stock
        });
    });

    return map;
}

// Get all products
router.get('/', async (req, res) => {
    try {
        const { category, tag, search, limit, offset } = req.query;

        let sql = 'SELECT * FROM products WHERE is_active = true';
        const params = [];

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (tag) {
            sql += ' AND tags @> ?::jsonb';
            params.push(JSON.stringify([tag]));
        }

        if (search) {
            sql += ' AND (title LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY created_at DESC';

        if (limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(limit));

            if (offset) {
                sql += ' OFFSET ?';
                params.push(parseInt(offset));
            }
        }

        const products = await dbAll(sql, params);

        // Parse JSON fields
        const parsedProducts = products.map(p => ({
            ...p,
            tags: parseJsonField(p.tags, []),
            colors: parseJsonField(p.colors, []),
            sizes: parseJsonField(p.sizes, []),
            images: parseJsonField(p.images, [])
        }));

        const variantsByProduct = await loadVariantsForProducts(parsedProducts.map(p => p.id));
        const withVariants = parsedProducts.map(p => ({
            ...p,
            variants: variantsByProduct[p.id] || []
        }));

        res.json(withVariants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get product by ID
router.get('/:id', async (req, res) => {
    try {
        const product = await dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Parse JSON fields
        const parsedProduct = {
            ...product,
            tags: parseJsonField(product.tags, []),
            colors: parseJsonField(product.colors, []),
            sizes: parseJsonField(product.sizes, []),
            images: parseJsonField(product.images, [])
        };

        const variants = await dbAll(
            'SELECT id, product_id, color, size, stock FROM product_variants WHERE product_id = ?',
            [req.params.id]
        );

        res.json({
            ...parsedProduct,
            variants: variants.map(v => ({
                id: v.id,
                productId: v.product_id,
                color: v.color,
                size: v.size,
                stock: v.stock
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create product
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { title, category, price, oldPrice, stock, tags, colors, sizes, description, material, care, fit, deliveryInfo, images, variants } = req.body;

        const normalizedVariants = normalizeVariants(variants);
        const totalStock = normalizedVariants.length > 0
            ? normalizedVariants.reduce((sum, v) => sum + v.stock, 0)
            : (stock || 0);

        // Generate SKU automatically
        const timestamp = Date.now().toString().slice(-6);
        const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
        const sku = `PRD-${timestamp}-${randomPart}`;

        const productId = crypto.randomUUID();
        const sql = `
            INSERT INTO products (
                id, title, sku, category, price, old_price, stock, tags, colors, sizes,
                description, material, care, fit, delivery_info, images
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        `;

        const result = await dbRun(sql, [
            productId, title, sku, category, price, oldPrice || null, totalStock,
            JSON.stringify(tags || []),
            JSON.stringify(colors || []),
            JSON.stringify(sizes || []),
            description || '', material || '', care || '', fit || '',
            deliveryInfo || '',
            JSON.stringify(images || [])
        ]);

        if (normalizedVariants.length > 0) {
            for (const variant of normalizedVariants) {
                const variantId = crypto.randomUUID();
                await dbRun(
                    'INSERT INTO product_variants (id, product_id, color, size, stock) VALUES (?, ?, ?, ?, ?)',
                    [variantId, result.id, variant.color, variant.size, variant.stock]
                );
            }
        }

        res.status(201).json({ id: result.id, message: 'Product created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update product
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { title, category, price, oldPrice, stock, tags, colors, sizes, description, material, care, fit, deliveryInfo, images, isActive, variants } = req.body;

        const existing = await dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const hasVariants = Array.isArray(variants);
        const normalizedVariants = normalizeVariants(variants);
        const totalStock = hasVariants
            ? normalizedVariants.reduce((sum, v) => sum + v.stock, 0)
            : (stock || 0);

        const sql = `
      UPDATE products SET
        title = ?, category = ?, price = ?, old_price = ?, stock = ?,
        tags = ?, colors = ?, sizes = ?, description = ?,
        material = ?, care = ?, fit = ?, delivery_info = ?,
        images = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

        await dbRun(sql, [
            title, category, price, oldPrice || null, totalStock,
            JSON.stringify(tags || []),
            JSON.stringify(colors || []),
            JSON.stringify(sizes || []),
            description || '', material || '', care || '', fit || '',
            deliveryInfo || '',
            JSON.stringify(images || []),
            isActive !== undefined ? !!isActive : true,
            req.params.id
        ]);

        const previousImages = parseJsonField(existing.images, []);
        const nextImages = Array.isArray(images) ? images : [];
        const removedImages = previousImages.filter(url => !nextImages.includes(url));

        for (const url of removedImages) {
            await safeDeleteProductImage(url, req.params.id);
        }

        if (hasVariants) {
            await dbRun('DELETE FROM product_variants WHERE product_id = ?', [req.params.id]);
            for (const variant of normalizedVariants) {
                const variantId = crypto.randomUUID();
                await dbRun(
                    'INSERT INTO product_variants (id, product_id, color, size, stock) VALUES (?, ?, ?, ?, ?)',
                    [variantId, req.params.id, variant.color, variant.size, variant.stock]
                );
            }
        }

        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete product
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const existing = await dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
        await dbRun('DELETE FROM products WHERE id = ?', [req.params.id]);
        const images = parseJsonField(existing?.images, []);
        for (const url of images) {
            await safeDeleteProductImage(url, null);
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
