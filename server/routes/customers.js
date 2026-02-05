import express from 'express';
import { dbAll, dbGet, dbRun } from '../database/db.js';

const router = express.Router();

// Get all customers
router.get('/', async (req, res) => {
    try {
        const customers = await dbAll('SELECT * FROM customers ORDER BY created_at DESC');
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
    try {
        const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id]);

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get customer orders
        const orders = await dbAll('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', [req.params.id]);

        res.json({
            ...customer,
            orders: orders.map(o => ({ ...o, items: JSON.parse(o.items || '[]') }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update customer
router.put('/:id', async (req, res) => {
    try {
        const { name, email, notes } = req.body;

        await dbRun(
            'UPDATE customers SET name = ?, email = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [name, email || null, notes || null, req.params.id]
        );

        res.json({ message: 'Customer updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete customer
router.delete('/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM customers WHERE id = ?', [req.params.id]);
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
