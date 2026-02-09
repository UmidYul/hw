import express from 'express';
import crypto from 'crypto';
import { dbAll, dbGet, dbRun } from '../database/db.js';
import { notifyNewOrder, notifyStatusChange } from '../services/telegram.js';
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from '../services/email.js';
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

// Get all orders
router.get('/', requireAdmin, async (req, res) => {
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
            items: parseJsonField(o.items, [])
        }));

        res.json(parsedOrders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get order by ID
router.get('/:id', requireAdmin, async (req, res) => {
    try {
        const order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const statusHistory = await dbAll(
            'SELECT status, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC',
            [req.params.id]
        );

        const parsedOrder = {
            ...order,
            items: parseJsonField(order.items, []),
            status_history: statusHistory
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
            const customerId = crypto.randomUUID();
            const customerResult = await dbRun(
                'INSERT INTO customers (id, name, phone, email, total_orders, total_spent) VALUES (?, ?, ?, ?, 1, ?) RETURNING id',
                [customerId, customerName, customerPhone, customerEmail || null, total]
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
            const variantId = item.variantId || item.variant_id;

            if (variantId) {
                console.log(`Updating stock for variant ${variantId}: -${item.quantity}`);
                await dbRun(
                    'UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ? ',
                    [item.quantity, variantId, item.quantity]
                );
                await dbRun(
                    `UPDATE products
                     SET stock = COALESCE((SELECT SUM(stock) FROM product_variants WHERE product_id = ?), 0)
                     WHERE id = ?`,
                    [productId, productId]
                );
            } else {
                console.log(`Updating stock for product ${productId}: -${item.quantity}`);
                await dbRun(
                    'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ? ',
                    [item.quantity, productId, item.quantity]
                );
            }
        }

        // Create order
        const orderId = crypto.randomUUID();
        const sql = `
            INSERT INTO orders (
                id, order_number, customer_id, customer_name, customer_phone, customer_email,
                shipping_address, items, subtotal, discount, shipping, total,
                status, payment_method, notes, promo_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        `;

        const result = await dbRun(sql, [
            orderId, orderNumber, customer.id, customerName, customerPhone, customerEmail || null,
            shippingAddress || null,
            JSON.stringify(items),
            subtotal, discount || 0, shipping || 0, total,
            'pending', paymentMethod || 'card', notes || null, promoCode || null
        ]);

        await dbRun(
            'INSERT INTO order_status_history (id, order_id, status) VALUES (?, ?, ?)',
            [crypto.randomUUID(), orderId, 'pending']
        );

        // Send Telegram notification
        try {
            await notifyNewOrder({
                orderId: result.id,
                orderNumber,
                customerName,
                customerPhone,
                customerEmail,
                shippingAddress,
                items,
                subtotal,
                discount: discount || 0,
                shipping: shipping || 0,
                total,
                notes
            });
        } catch (notifyError) {
            console.error('Failed to send Telegram notification:', notifyError);
            // Don't fail the order if notification fails
        }

        if (customerEmail) {
            try {
                await sendOrderConfirmationEmail({
                    to: customerEmail,
                    orderNumber,
                    customerName,
                    items,
                    total,
                    shippingAddress
                });
            } catch (emailError) {
                console.error('Failed to send order confirmation email:', emailError);
            }
        }

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
router.patch('/:id/status', requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;

        // Get current order for notification
        const order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const oldStatus = order.status;

        await dbRun(
            'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, req.params.id]
        );

        if (status !== oldStatus) {
            await dbRun(
                'INSERT INTO order_status_history (id, order_id, status) VALUES (?, ?, ?)',
                [crypto.randomUUID(), req.params.id, status]
            );
        }

        // Send Telegram notification
        try {
            console.log('Sending status change notification:', {
                orderId: req.params.id,
                oldStatus,
                newStatus: status
            });

            await notifyStatusChange(
                {
                    orderId: req.params.id,
                    orderNumber: order.order_number,
                    customerName: order.customer_name,
                    customerPhone: order.customer_phone
                },
                oldStatus,
                status
            );
        } catch (notifyError) {
            console.error('Failed to send Telegram notification:', notifyError);
        }

        if (order.customer_email && status !== oldStatus) {
            try {
                const parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                await sendOrderStatusEmail({
                    to: order.customer_email,
                    orderNumber: order.order_number,
                    customerName: order.customer_name,
                    status,
                    items: parsedItems,
                    subtotal: order.subtotal,
                    discount: order.discount,
                    shipping: order.shipping,
                    total: order.total,
                    shippingAddress: order.shipping_address
                });
            } catch (emailError) {
                console.error('Failed to send order status email:', emailError);
            }
        }

        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete order
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await dbRun('DELETE FROM orders WHERE id = ?', [req.params.id]);
        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
