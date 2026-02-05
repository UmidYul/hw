import express from 'express';
import { dbAll, dbGet, dbRun } from '../database/db.js';

const router = express.Router();

// Get all discounts
router.get('/', async (req, res) => {
    try {
        const discounts = await dbAll('SELECT * FROM discounts ORDER BY created_at DESC');
        res.json(discounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get active discounts
router.get('/active', async (req, res) => {
    try {
        const sql = `
      SELECT * FROM discounts 
      WHERE is_active = 1 
      AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
      AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
    `;

        const discounts = await dbAll(sql);
        res.json(discounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get discount by ID
router.get('/:id', async (req, res) => {
    try {
        const discount = await dbGet('SELECT * FROM discounts WHERE id = ?', [req.params.id]);
        if (!discount) {
            return res.status(404).json({ error: 'Discount not found' });
        }
        res.json(discount);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create discount
router.post('/', async (req, res) => {
    try {
        const {
            name,
            description,
            discount_type,
            discount_value,
            target,
            min_amount,
            priority,
            is_active,
            combine_with_other,
            start_date,
            end_date,
            category_id,
            collection_id,
            product_ids
        } = req.body;

        const sql = `
      INSERT INTO discounts (
        name, description, discount_type, discount_value, target,
        category_id, collection_id, product_ids, min_amount, priority,
        is_active, combine_with_other, start_date, end_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const productIdsJson = product_ids ?
            (typeof product_ids === 'string' ? product_ids : JSON.stringify(product_ids)) :
            null;

        const result = await dbRun(sql, [
            name,
            description || null,
            discount_type,
            discount_value,
            target,
            category_id || null,
            collection_id || null,
            productIdsJson,
            min_amount || 0,
            priority || 0,
            is_active !== undefined ? is_active : 1,
            combine_with_other || 0,
            start_date || null,
            end_date || null
        ]);

        res.status(201).json({ id: result.id, message: 'Discount created successfully' });
    } catch (error) {
        console.error('Error creating discount:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update discount
router.put('/:id', async (req, res) => {
    try {
        const {
            name,
            description,
            discount_type,
            discount_value,
            target,
            min_amount,
            priority,
            is_active,
            combine_with_other,
            start_date,
            end_date,
            category_id,
            collection_id,
            product_ids
        } = req.body;

        const sql = `
      UPDATE discounts SET
        name = ?, description = ?, discount_type = ?, discount_value = ?, target = ?,
        category_id = ?, collection_id = ?, product_ids = ?, min_amount = ?, priority = ?,
        is_active = ?, combine_with_other = ?, start_date = ?, end_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

        const productIdsJson = product_ids ?
            (typeof product_ids === 'string' ? product_ids : JSON.stringify(product_ids)) :
            null;

        await dbRun(sql, [
            name,
            description || null,
            discount_type,
            discount_value,
            target,
            category_id || null,
            collection_id || null,
            productIdsJson,
            min_amount || 0,
            priority || 0,
            is_active !== undefined ? is_active : 1,
            combine_with_other || 0,
            start_date || null,
            end_date || null,
            req.params.id
        ]);

        res.json({ message: 'Discount updated successfully' });
    } catch (error) {
        console.error('Error updating discount:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete discount
router.delete('/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM discounts WHERE id = ?', [req.params.id]);
        res.json({ message: 'Discount deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
