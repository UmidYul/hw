import express from 'express';
import { dbAll, dbGet, dbRun } from '../database/db.js';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();

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

// Get all collections
router.get('/', async (req, res) => {
    try {
        const { visible } = req.query;

        let sql = 'SELECT * FROM collections';
        const params = [];

        if (visible !== undefined) {
            sql += ' WHERE is_visible = ?';
            params.push(visible === 'true');
        }

        sql += ' ORDER BY order_index ASC, created_at DESC';

        const collections = await dbAll(sql, params);

        // Parse JSON fields
        const parsedCollections = collections.map(c => ({
            ...c,
            conditions: parseJsonField(c.conditions, null),
            productIds: parseJsonField(c.product_ids, [])
        }));

        res.json(parsedCollections);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get collection by slug
router.get('/slug/:slug', async (req, res) => {
    try {
        const collection = await dbGet('SELECT * FROM collections WHERE slug = ?', [req.params.slug]);

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        const parsedCollection = {
            ...collection,
            conditions: parseJsonField(collection.conditions, null),
            productIds: parseJsonField(collection.product_ids, [])
        };

        // Get products for this collection
        let products = [];

        if (collection.type === 'manual' && parsedCollection.productIds.length > 0) {
            const placeholders = parsedCollection.productIds.map(() => '?').join(',');
            const sql = `SELECT * FROM products WHERE id IN (${placeholders}) AND is_active = true`;
            products = await dbAll(sql, parsedCollection.productIds);
        } else if (collection.type === 'auto' && parsedCollection.conditions) {
            // Auto collection based on conditions
            let sql = 'SELECT * FROM products WHERE is_active = true';
            const params = [];

            if (parsedCollection.conditions.category) {
                sql += ' AND category = ?';
                params.push(parsedCollection.conditions.category);
            }

            if (parsedCollection.conditions.tag) {
                sql += ' AND tags @> ?::jsonb';
                params.push(JSON.stringify([parsedCollection.conditions.tag]));
            }

            products = await dbAll(sql, params);
        }

        // Parse product JSON fields
        const parsedProducts = products.map(p => ({
            ...p,
            tags: parseJsonField(p.tags, []),
            colors: parseJsonField(p.colors, []),
            sizes: parseJsonField(p.sizes, []),
            images: parseJsonField(p.images, [])
        }));

        res.json({
            ...parsedCollection,
            products: parsedProducts
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get collection by ID
router.get('/:id', async (req, res) => {
    try {
        const collection = await dbGet('SELECT * FROM collections WHERE id = ?', [req.params.id]);

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        const parsedCollection = {
            ...collection,
            conditions: parseJsonField(collection.conditions, null),
            productIds: parseJsonField(collection.product_ids, [])
        };

        res.json(parsedCollection);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create collection
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { name, slug, description, type, conditions, productIds, isVisible, orderIndex } = req.body;

        const sql = `
            INSERT INTO collections (
                name, slug, description, type, conditions, product_ids, is_visible, order_index
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        `;

        const result = await dbRun(sql, [
            name, slug, description || null,
            type || 'manual',
            conditions ? JSON.stringify(conditions) : null,
            productIds ? JSON.stringify(productIds) : JSON.stringify([]),
            isVisible !== undefined ? !!isVisible : true,
            orderIndex || 0
        ]);

        res.status(201).json({ id: result.id, message: 'Collection created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update collection
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { name, slug, description, type, conditions, productIds, isVisible, orderIndex } = req.body;

        const sql = `
      UPDATE collections SET
        name = ?, slug = ?, description = ?, type = ?,
        conditions = ?, product_ids = ?, is_visible = ?,
        order_index = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

        await dbRun(sql, [
            name, slug, description || null, type || 'manual',
            conditions ? JSON.stringify(conditions) : null,
            productIds ? JSON.stringify(productIds) : JSON.stringify([]),
            isVisible !== undefined ? !!isVisible : true,
            orderIndex || 0,
            req.params.id
        ]);

        res.json({ message: 'Collection updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete collection
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await dbRun('DELETE FROM collections WHERE id = ?', [req.params.id]);
        res.json({ message: 'Collection deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
