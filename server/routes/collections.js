import express from 'express';
import { dbAll, dbGet, dbRun } from '../database/db.js';

const router = express.Router();

// Get all collections
router.get('/', async (req, res) => {
    try {
        const { visible } = req.query;

        let sql = 'SELECT * FROM collections';
        const params = [];

        if (visible !== undefined) {
            sql += ' WHERE is_visible = ?';
            params.push(visible === 'true' ? 1 : 0);
        }

        sql += ' ORDER BY order_index ASC, created_at DESC';

        const collections = await dbAll(sql, params);

        // Parse JSON fields
        const parsedCollections = collections.map(c => ({
            ...c,
            conditions: c.conditions ? JSON.parse(c.conditions) : null,
            productIds: c.product_ids ? JSON.parse(c.product_ids) : []
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
            conditions: collection.conditions ? JSON.parse(collection.conditions) : null,
            productIds: collection.product_ids ? JSON.parse(collection.product_ids) : []
        };

        // Get products for this collection
        let products = [];

        if (collection.type === 'manual' && parsedCollection.productIds.length > 0) {
            const placeholders = parsedCollection.productIds.map(() => '?').join(',');
            const sql = `SELECT * FROM products WHERE id IN (${placeholders}) AND is_active = 1`;
            products = await dbAll(sql, parsedCollection.productIds);
        } else if (collection.type === 'auto' && parsedCollection.conditions) {
            // Auto collection based on conditions
            let sql = 'SELECT * FROM products WHERE is_active = 1';
            const params = [];

            if (parsedCollection.conditions.category) {
                sql += ' AND category = ?';
                params.push(parsedCollection.conditions.category);
            }

            if (parsedCollection.conditions.tag) {
                sql += ' AND tags LIKE ?';
                params.push(`%"${parsedCollection.conditions.tag}"%`);
            }

            products = await dbAll(sql, params);
        }

        // Parse product JSON fields
        const parsedProducts = products.map(p => ({
            ...p,
            tags: JSON.parse(p.tags || '[]'),
            colors: JSON.parse(p.colors || '[]'),
            sizes: JSON.parse(p.sizes || '[]'),
            images: JSON.parse(p.images || '[]')
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
            conditions: collection.conditions ? JSON.parse(collection.conditions) : null,
            productIds: collection.product_ids ? JSON.parse(collection.product_ids) : []
        };

        res.json(parsedCollection);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create collection
router.post('/', async (req, res) => {
    try {
        const { name, slug, description, type, conditions, productIds, isVisible, orderIndex } = req.body;

        const sql = `
      INSERT INTO collections (
        name, slug, description, type, conditions, product_ids, is_visible, order_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const result = await dbRun(sql, [
            name, slug, description || null,
            type || 'manual',
            conditions ? JSON.stringify(conditions) : null,
            productIds ? JSON.stringify(productIds) : JSON.stringify([]),
            isVisible !== undefined ? isVisible : 1,
            orderIndex || 0
        ]);

        res.status(201).json({ id: result.id, message: 'Collection created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update collection
router.put('/:id', async (req, res) => {
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
            isVisible !== undefined ? isVisible : 1,
            orderIndex || 0,
            req.params.id
        ]);

        res.json({ message: 'Collection updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete collection
router.delete('/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM collections WHERE id = ?', [req.params.id]);
        res.json({ message: 'Collection deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
