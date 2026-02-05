import express from 'express';
import { dbAll, dbGet, dbRun } from '../database/db.js';

const router = express.Router();

// Get all orders
router.get('/', async (req, res) => {
    try {
        const { status, limit, offset } = req.query;

        let sql = 'SELECT * FROM orders';
        const params = [];

        if (status) {
            sql += ' WHERE status = ?';
            params.push(status);
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

        const orders = await dbAll(sql, params);

        // Parse JSON fields
        const parsedOrders = orders.map(o => ({
            ...o,
            items: JSON.parse(o.items || '[]')
        }));

        res.json(parsedOrders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get order by ID
router.get('/:id', async (req, res) => {
    try {
        const order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const parsedOrder = {
            ...order,
            items: JSON.parse(order.items || '[]')
        };

        res.json(parsedOrder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create order
router.post('/', async (req, res) => {
    try {
        const {
            customerName, customerPhone, customerEmail, shippingAddress,
            items, subtotal, discount, shipping, total, paymentMethod, notes, promoCode
        } = req.body;

        // Generate order number
        const orderNumber = 'ORD-' + Date.now();

        // Check if customer exists
        let customer = await dbGet('SELECT * FROM customers WHERE phone = ?', [customerPhone]);

        if (!customer) {
            // Create new customer
            const customerResult = await dbRun(
                'INSERT INTO customers (name, phone, email, total_orders, total_spent) VALUES (?, ?, ?, 1, ?)',
                [customerName, customerPhone, customerEmail || null, total]
            );
            customer = { id: customerResult.id };
        } else {
            // Update existing customer
            await dbRun(
                `UPDATE customers SET
          total_orders = total_orders + 1,
          total_spent = total_spent + ?,
          last_order_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
                [total, customer.id]
            );
        }

        // Update stock for each item
        console.log('Updating stock for items:', items);
        for (const item of items) {
            const productId = item.productId || item.id;
            console.log(`Updating stock for product ${productId}: -${item.quantity}`);
            const result = await dbRun(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                [item.quantity, productId]
            );
            console.log(`Stock update result:`, result);
        }

        // Create order
        const sql = `
      INSERT INTO orders (
        order_number, customer_id, customer_name, customer_phone, customer_email,
        shipping_address, items, subtotal, discount, shipping, total,
        status, payment_method, notes, promo_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const result = await dbRun(sql, [
            orderNumber, customer.id, customerName, customerPhone, customerEmail || null,
            shippingAddress || null,
            JSON.stringify(items),
            subtotal, discount || 0, shipping || 0, total,
            'pending', paymentMethod || 'card', notes || null, promoCode || null
        ]);

        res.status(201).json({
            id: result.id,
            orderNumber,
            message: 'Order created successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        await dbRun(
            'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, req.params.id]
        );

        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete order
router.delete('/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM orders WHERE id = ?', [req.params.id]);
        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
