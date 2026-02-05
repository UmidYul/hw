import express from 'express';
import { dbAll, dbGet, dbRun } from '../database/db.js';

const router = express.Router();

// Get all products
router.get('/', async (req, res) => {
    try {
        const { category, tag, search, limit, offset } = req.query;

        let sql = 'SELECT * FROM products WHERE is_active = 1';
        const params = [];

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (tag) {
            sql += ' AND tags LIKE ?';
            params.push(`%"${tag}"%`);
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
            tags: JSON.parse(p.tags || '[]'),
            colors: JSON.parse(p.colors || '[]'),
            sizes: JSON.parse(p.sizes || '[]'),
            images: JSON.parse(p.images || '[]')
        }));

        res.json(parsedProducts);
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
            tags: JSON.parse(product.tags || '[]'),
            colors: JSON.parse(product.colors || '[]'),
            sizes: JSON.parse(product.sizes || '[]'),
            images: JSON.parse(product.images || '[]')
        };

        res.json(parsedProduct);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create product
router.post('/', async (req, res) => {
    try {
        const { title, category, price, oldPrice, stock, tags, colors, sizes, description, material, care, fit, deliveryInfo, images } = req.body;

        // Generate SKU automatically
        const timestamp = Date.now().toString().slice(-6);
        const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
        const sku = `PRD-${timestamp}-${randomPart}`;

        const sql = `
      INSERT INTO products (
        title, sku, category, price, old_price, stock, tags, colors, sizes,
        description, material, care, fit, delivery_info, images
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const result = await dbRun(sql, [
            title, sku, category, price, oldPrice || null, stock || 0,
            JSON.stringify(tags || []),
            JSON.stringify(colors || []),
            JSON.stringify(sizes || []),
            description || '', material || '', care || '', fit || '',
            deliveryInfo || '',
            JSON.stringify(images || [])
        ]);

        res.status(201).json({ id: result.id, message: 'Product created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update product
router.put('/:id', async (req, res) => {
    try {
        const { title, category, price, oldPrice, stock, tags, colors, sizes, description, material, care, fit, deliveryInfo, images, isActive } = req.body;

        const sql = `
      UPDATE products SET
        title = ?, category = ?, price = ?, old_price = ?, stock = ?,
        tags = ?, colors = ?, sizes = ?, description = ?,
        material = ?, care = ?, fit = ?, delivery_info = ?,
        images = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

        await dbRun(sql, [
            title, category, price, oldPrice || null, stock || 0,
            JSON.stringify(tags || []),
            JSON.stringify(colors || []),
            JSON.stringify(sizes || []),
            description || '', material || '', care || '', fit || '',
            deliveryInfo || '',
            JSON.stringify(images || []),
            isActive !== undefined ? isActive : 1,
            req.params.id
        ]);

        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete product
router.delete('/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
