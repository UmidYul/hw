import express from 'express';
import { dbAll, dbGet, dbRun } from '../database/db.js';

const router = express.Router();

// Get content setting by key
router.get('/:key', async (req, res) => {
    try {
        const setting = await dbGet('SELECT * FROM content_settings WHERE key = ?', [req.params.key]);

        if (!setting) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json({
            key: setting.key,
            value: setting.value ? JSON.parse(setting.value) : null,
            updatedAt: setting.updated_at
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all content settings
router.get('/', async (req, res) => {
    try {
        const settings = await dbAll('SELECT * FROM content_settings');

        const parsed = {};
        settings.forEach(s => {
            parsed[s.key] = s.value ? JSON.parse(s.value) : null;
        });

        res.json(parsed);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get featured collections with full details
router.get('/featured/collections', async (req, res) => {
    try {
        // Get featured collections IDs from content_settings
        const setting = await dbGet('SELECT * FROM content_settings WHERE key = ?', ['featuredCollections']);

        if (!setting || !setting.value) {
            return res.json([]);
        }

        const featuredIds = JSON.parse(setting.value);

        if (!Array.isArray(featuredIds) || featuredIds.length === 0) {
            return res.json([]);
        }

        // Get full collection details for featured collections
        const placeholders = featuredIds.map(() => '?').join(',');
        const collections = await dbAll(
            `SELECT * FROM collections WHERE id IN (${placeholders}) AND is_active = 1 ORDER BY name`,
            featuredIds
        );

        // For each collection, get product count
        const collectionsWithCount = await Promise.all(
            collections.map(async (collection) => {
                const productIds = collection.product_ids ? JSON.parse(collection.product_ids) : [];
                return {
                    ...collection,
                    product_ids: productIds,
                    productCount: productIds.length
                };
            })
        );

        res.json(collectionsWithCount);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update content setting
router.put('/:key', async (req, res) => {
    try {
        const { value } = req.body;

        // Check if setting exists
        const existing = await dbGet('SELECT * FROM content_settings WHERE key = ?', [req.params.key]);

        if (existing) {
            await dbRun(
                'UPDATE content_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
                [JSON.stringify(value), req.params.key]
            );
        } else {
            await dbRun(
                'INSERT INTO content_settings (key, value) VALUES (?, ?)',
                [req.params.key, JSON.stringify(value)]
            );
        }

        res.json({ message: 'Content setting updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
