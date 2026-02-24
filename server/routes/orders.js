import express from 'express';
import crypto from 'crypto';
import pool, { dbAll, dbGet, dbRun } from '../database/db.js';
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

const allowedOrderStatuses = new Set(['pending', 'processing', 'shipped', 'completed', 'cancelled']);

const toNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const normalizeText = (value) => {
    const trimmed = String(value || '').trim();
    return trimmed || null;
};

const normalizePhone = (value) => String(value || '').trim();

const normalizeOrderItems = (items) => {
    if (!Array.isArray(items)) return [];

    return items
        .map((item) => {
            const quantity = Number.parseInt(item?.quantity, 10);
            const productId = String(item?.productId || item?.id || '').trim();
            const variantIdRaw = item?.variantId ?? item?.variant_id ?? null;
            const variantId = variantIdRaw === null || variantIdRaw === undefined ? null : String(variantIdRaw).trim();

            return {
                productId,
                variantId: variantId || null,
                quantity,
                color: normalizeText(item?.color),
                size: normalizeText(item?.size),
                image: normalizeText(item?.image)
            };
        })
        .filter((item) => item.productId && Number.isInteger(item.quantity) && item.quantity > 0);
};

const serializeShippingAddress = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return null;
};

const calculatePromoDiscount = (promo, amount) => {
    if (!promo) return 0;
    if (promo.type === 'percent') {
        return Math.round((amount * toNumber(promo.value, 0)) / 100);
    }
    return toNumber(promo.value, 0);
};

const throwHttpError = (status, message) => {
    const error = new Error(message);
    error.status = status;
    throw error;
};

const normalizeOrderStatus = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || null;
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
    let dbClient;
    try {
        const {
            customerName, customerPhone, customerEmail, shippingAddress,
            items, paymentMethod, notes, promoCode
        } = req.body || {};

        const normalizedCustomerName = normalizeText(customerName);
        const normalizedCustomerPhone = normalizePhone(customerPhone);
        const normalizedCustomerEmail = normalizeText(customerEmail);
        const normalizedPaymentMethod = normalizeText(paymentMethod) || 'card';
        const normalizedNotes = normalizeText(notes);
        const normalizedShippingAddress = serializeShippingAddress(shippingAddress);
        const normalizedPromoCode = normalizeText(promoCode)?.toUpperCase() || null;
        const normalizedItems = normalizeOrderItems(items);

        if (!normalizedCustomerName) {
            return res.status(400).json({ error: 'Customer name is required' });
        }
        if (!normalizedCustomerPhone) {
            return res.status(400).json({ error: 'Customer phone is required' });
        }
        if (!normalizedItems.length) {
            return res.status(400).json({ error: 'At least one valid order item is required' });
        }

        // Generate order number
        const orderNumber = `ORD-${Date.now()}`;
        const variantProductIdsToSync = new Set();
        const resolvedItems = [];
        let subtotal = 0;
        let discount = 0;
        let shipping = 0;
        let total = 0;
        let appliedPromoCode = null;
        let customerId = null;

        dbClient = await pool.connect();
        await dbClient.query('BEGIN');

        const existingCustomerResult = await dbClient.query(
            'SELECT * FROM customers WHERE phone = $1 LIMIT 1 FOR UPDATE',
            [normalizedCustomerPhone]
        );
        const existingCustomer = existingCustomerResult.rows[0] || null;

        for (const requestedItem of normalizedItems) {
            let variantRow = null;
            if (requestedItem.variantId) {
                const variantResult = await dbClient.query(
                    'SELECT id, product_id, color, size, stock FROM product_variants WHERE id = $1 FOR UPDATE',
                    [requestedItem.variantId]
                );
                if (!variantResult.rows.length) {
                    throwHttpError(400, 'Selected product variant does not exist');
                }
                variantRow = variantResult.rows[0];
                if (String(variantRow.product_id) !== String(requestedItem.productId)) {
                    throwHttpError(400, 'Product variant does not match the selected product');
                }
            }

            const productResult = await dbClient.query(
                'SELECT id, title, price, old_price, is_active, stock FROM products WHERE id = $1 FOR UPDATE',
                [requestedItem.productId]
            );

            if (!productResult.rows.length) {
                throwHttpError(400, 'One of the selected products does not exist');
            }

            const productRow = productResult.rows[0];
            if (!productRow.is_active) {
                throwHttpError(400, 'One of the selected products is unavailable');
            }

            const availableStock = variantRow
                ? toNumber(variantRow.stock, 0)
                : toNumber(productRow.stock, 0);

            if (requestedItem.quantity > availableStock) {
                throwHttpError(400, `Insufficient stock for product: ${productRow.title}`);
            }

            if (variantRow) {
                await dbClient.query(
                    'UPDATE product_variants SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [requestedItem.quantity, variantRow.id]
                );
                variantProductIdsToSync.add(String(productRow.id));
            } else {
                await dbClient.query(
                    'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [requestedItem.quantity, productRow.id]
                );
            }

            const unitPrice = toNumber(productRow.price, 0);
            const oldPrice = toNumber(productRow.old_price, 0);
            const hasOldPrice = oldPrice > unitPrice;
            subtotal += unitPrice * requestedItem.quantity;

            resolvedItems.push({
                id: String(productRow.id),
                productId: String(productRow.id),
                variantId: variantRow ? String(variantRow.id) : null,
                title: String(productRow.title || 'Товар'),
                quantity: requestedItem.quantity,
                price: unitPrice,
                oldPrice: hasOldPrice ? oldPrice : null,
                size: variantRow?.size || requestedItem.size || null,
                color: variantRow?.color || requestedItem.color || null,
                image: requestedItem.image || null
            });
        }

        for (const productId of variantProductIdsToSync) {
            await dbClient.query(
                `UPDATE products
                 SET stock = COALESCE((SELECT SUM(stock) FROM product_variants WHERE product_id = $1), 0),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [productId]
            );
        }

        if (normalizedPromoCode) {
            const promoResult = await dbClient.query(
                `SELECT * FROM promocodes
                 WHERE code = $1
                   AND is_active = true
                   AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
                   AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
                   AND (usage_limit IS NULL OR usage_count < usage_limit)
                 FOR UPDATE`,
                [normalizedPromoCode]
            );

            if (promoResult.rows.length > 0) {
                const promo = promoResult.rows[0];
                const minAmount = toNumber(promo.min_amount, 0);
                const promoBase = promo.exclude_sale
                    ? resolvedItems.reduce((sum, item) => sum + (item.oldPrice ? 0 : item.price * item.quantity), 0)
                    : subtotal;

                if (promoBase >= minAmount) {
                    let canUsePromo = true;
                    if (promo.max_uses_per_user) {
                        const usageResult = await dbClient.query(
                            `SELECT COUNT(*)::int AS count
                             FROM promocode_usage
                             WHERE promocode_id = $1 AND customer_phone = $2`,
                            [promo.id, normalizedCustomerPhone]
                        );
                        const usageCount = usageResult.rows[0]?.count || 0;
                        canUsePromo = usageCount < toNumber(promo.max_uses_per_user, 0);
                    }

                    if (canUsePromo) {
                        discount = Math.min(calculatePromoDiscount(promo, promoBase), subtotal);
                        appliedPromoCode = promo.code;

                        await dbClient.query(
                            `INSERT INTO promocode_usage (id, promocode_id, customer_phone)
                             VALUES ($1, $2, $3)`,
                            [crypto.randomUUID(), promo.id, normalizedCustomerPhone]
                        );
                        await dbClient.query(
                            `UPDATE promocodes
                             SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
                             WHERE id = $1`,
                            [promo.id]
                        );
                    }
                }
            }
        }

        const settingsResult = await dbClient.query(
            'SELECT shipping_cost, free_shipping_threshold FROM settings LIMIT 1'
        );
        const shippingCost = toNumber(settingsResult.rows[0]?.shipping_cost, 0);
        const freeShippingThreshold = toNumber(settingsResult.rows[0]?.free_shipping_threshold, 0);
        const subtotalAfterDiscount = Math.max(0, subtotal - discount);
        shipping = freeShippingThreshold > 0 && subtotalAfterDiscount >= freeShippingThreshold
            ? 0
            : shippingCost;
        total = subtotalAfterDiscount + shipping;

        if (existingCustomer) {
            customerId = existingCustomer.id;
            await dbClient.query(
                `UPDATE customers SET
                    name = $1,
                    email = $2,
                    total_orders = total_orders + 1,
                    total_spent = total_spent + $3,
                    last_order_date = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4`,
                [normalizedCustomerName, normalizedCustomerEmail, total, customerId]
            );
        } else {
            customerId = crypto.randomUUID();
            await dbClient.query(
                `INSERT INTO customers (id, name, phone, email, total_orders, total_spent, last_order_date)
                 VALUES ($1, $2, $3, $4, 1, $5, CURRENT_TIMESTAMP)`,
                [customerId, normalizedCustomerName, normalizedCustomerPhone, normalizedCustomerEmail, total]
            );
        }

        const orderId = crypto.randomUUID();
        await dbClient.query(
            `INSERT INTO orders (
                id, order_number, customer_id, customer_name, customer_phone, customer_email,
                shipping_address, items, subtotal, discount, shipping, total,
                status, payment_method, notes, promo_code
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8::jsonb, $9, $10, $11, $12,
                $13, $14, $15, $16
            )`,
            [
                orderId,
                orderNumber,
                customerId,
                normalizedCustomerName,
                normalizedCustomerPhone,
                normalizedCustomerEmail,
                normalizedShippingAddress,
                JSON.stringify(resolvedItems),
                subtotal,
                discount,
                shipping,
                total,
                'pending',
                normalizedPaymentMethod,
                normalizedNotes,
                appliedPromoCode
            ]
        );

        await dbClient.query(
            'INSERT INTO order_status_history (id, order_id, status) VALUES ($1, $2, $3)',
            [crypto.randomUUID(), orderId, 'pending']
        );

        await dbClient.query('COMMIT');
        dbClient.release();
        dbClient = null;

        // Send Telegram notification
        try {
            await notifyNewOrder({
                orderId,
                orderNumber,
                customerName: normalizedCustomerName,
                customerPhone: normalizedCustomerPhone,
                customerEmail: normalizedCustomerEmail,
                shippingAddress,
                items: resolvedItems,
                subtotal,
                discount,
                shipping,
                total,
                notes: normalizedNotes
            });
        } catch (notifyError) {
            console.error('Failed to send Telegram notification:', notifyError);
            // Don't fail the order if notification fails
        }

        if (normalizedCustomerEmail) {
            try {
                await sendOrderConfirmationEmail({
                    to: normalizedCustomerEmail,
                    orderNumber,
                    customerName: normalizedCustomerName,
                    items: resolvedItems,
                    total,
                    shippingAddress
                });
            } catch (emailError) {
                console.error('Failed to send order confirmation email:', emailError);
            }
        }

        res.status(201).json({
            id: orderId,
            orderNumber,
            message: 'Order created successfully'
        });
    } catch (error) {
        if (dbClient) {
            try {
                await dbClient.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Order rollback failed:', rollbackError);
            }
            dbClient.release();
        }
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Update order status
router.patch('/:id/status', requireAdmin, async (req, res) => {
    try {
        const nextStatus = normalizeOrderStatus(req.body?.status);
        if (!nextStatus || !allowedOrderStatuses.has(nextStatus)) {
            return res.status(400).json({ error: 'Invalid order status' });
        }

        // Get current order for notification
        const order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const oldStatus = order.status;

        await dbRun(
            'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [nextStatus, req.params.id]
        );

        if (nextStatus !== oldStatus) {
            await dbRun(
                'INSERT INTO order_status_history (id, order_id, status) VALUES (?, ?, ?)',
                [crypto.randomUUID(), req.params.id, nextStatus]
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
                nextStatus
            );
        } catch (notifyError) {
            console.error('Failed to send Telegram notification:', notifyError);
        }

        if (order.customer_email && nextStatus !== oldStatus) {
            try {
                const parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                await sendOrderStatusEmail({
                    to: order.customer_email,
                    orderNumber: order.order_number,
                    customerName: order.customer_name,
                    status: nextStatus,
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
