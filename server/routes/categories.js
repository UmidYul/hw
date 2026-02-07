import express from 'express';
import crypto from 'crypto';
import { dbAll, dbGet, dbRun } from '../database/db.js';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
    try {
        const categories = await dbAll('SELECT * FROM categories ORDER BY order_index ASC, name ASC');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get visible categories
router.get('/visible', async (req, res) => {
    try {
        const categories = await dbAll('SELECT * FROM categories WHERE is_visible = true ORDER BY order_index ASC');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get category by ID
router.get('/:id', async (req, res) => {
    try {
        const category = await dbGet('SELECT * FROM categories WHERE id = ?', [req.params.id]);

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create category
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { name, slug, description, image, parentId, orderIndex, isVisible } = req.body;

        const categoryId = crypto.randomUUID();
        const sql = `
            INSERT INTO categories (id, name, slug, description, image, parent_id, order_index, is_visible)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        `;

        const result = await dbRun(sql, [
            categoryId, name, slug, description || null, image || null,
            parentId || null, orderIndex || 0, isVisible !== undefined ? !!isVisible : true
        ]);

        res.status(201).json({ id: result.id, message: 'Category created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update category
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { name, slug, description, image, parentId, orderIndex, isVisible } = req.body;

        const sql = `
      UPDATE categories SET
        name = ?, slug = ?, description = ?, image = ?,
        parent_id = ?, order_index = ?, is_visible = ?
      WHERE id = ?
    `;

        await dbRun(sql, [
            name, slug, description || null, image || null,
            parentId || null, orderIndex || 0, isVisible !== undefined ? !!isVisible : true,
            req.params.id
        ]);

        res.json({ message: 'Category updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete category
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await dbRun('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
