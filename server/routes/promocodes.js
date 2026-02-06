import express from 'express';
import { dbAll, dbGet, dbRun } from '../database/db.js';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();

// Get all promocodes
router.get('/', requireAdmin, async (req, res) => {
    try {
        const promocodes = await dbAll('SELECT * FROM promocodes ORDER BY created_at DESC');
        res.json(promocodes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get promocode by ID
router.get('/:id', requireAdmin, async (req, res) => {
    try {
        const promocode = await dbGet('SELECT * FROM promocodes WHERE id = ?', [req.params.id]);

        if (!promocode) {
            return res.status(404).json({ error: 'Promocode not found' });
        }

        res.json(promocode);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate promocode
router.post('/validate', async (req, res) => {
    try {
        const { code, amount, customerIdentifier } = req.body; // email or phone

        const sql = `
      SELECT * FROM promocodes 
      WHERE code = ? 
    AND is_active = true
      AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
      AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
      AND (usage_limit IS NULL OR usage_count < usage_limit)
    `;

        const promo = await dbGet(sql, [code.toUpperCase()]);

        if (!promo) {
            return res.status(404).json({ valid: false, message: 'Промокод не найден или истек' });
        }

        // Check min amount
        if (promo.min_amount && amount < promo.min_amount) {
            return res.json({
                valid: false,
                message: `Минимальная сумма заказа ${promo.min_amount} Сумм`
            });
        }

        // Check per-user limit if specified and customer identifier provided
        if (promo.max_uses_per_user && customerIdentifier) {
            const usageCountSql = `
                SELECT COUNT(*) as count FROM promocode_usage 
                WHERE promocode_id = ? AND customer_phone = ?
            `;
            const usageResult = await dbGet(usageCountSql, [promo.id, customerIdentifier]);

            if (usageResult.count >= promo.max_uses_per_user) {
                return res.json({
                    valid: false,
                    message: `Вы уже использовали этот промокод максимальное количество раз (${promo.max_uses_per_user})`
                });
            }
        }

        let discount = 0;
        if (promo.type === 'percent') {
            discount = Math.round(amount * promo.value / 100);
        } else {
            discount = promo.value;
        }

        res.json({
            valid: true,
            type: promo.type,
            value: promo.value,
            discount,
            excludeSale: promo.exclude_sale
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create promocode
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { code, type, value, minAmount, excludeSale, usageLimit, maxUsesPerUser, startDate, endDate } = req.body;

        const formatDateForDb = (isoDate) => {
            if (!isoDate) return null;
            return new Date(isoDate).toISOString();
        };

        const sql = `
            INSERT INTO promocodes (code, type, value, min_amount, exclude_sale, usage_limit, max_uses_per_user, start_date, end_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        `;

        const result = await dbRun(sql, [
            code.toUpperCase(), type, value, minAmount || 0,
            excludeSale ? true : false, usageLimit || null, maxUsesPerUser || null,
            formatDateForDb(startDate), formatDateForDb(endDate)
        ]);

        res.status(201).json({ id: result.id, message: 'Promocode created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update promocode
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { code, type, value, minAmount, excludeSale, usageLimit, maxUsesPerUser, isActive, startDate, endDate } = req.body;

        const formatDateForDb = (isoDate) => {
            if (!isoDate) return null;
            return new Date(isoDate).toISOString();
        };

        const sql = `
      UPDATE promocodes SET
        code = ?, type = ?, value = ?, min_amount = ?,
        exclude_sale = ?, usage_limit = ?, max_uses_per_user = ?, is_active = ?,
        start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

        await dbRun(sql, [
            code.toUpperCase(), type, value, minAmount || 0,
            excludeSale ? true : false, usageLimit || null, maxUsesPerUser || null, isActive ? true : false,
            formatDateForDb(startDate), formatDateForDb(endDate), req.params.id
        ]);

        res.json({ message: 'Promocode updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete promocode
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await dbRun('DELETE FROM promocodes WHERE id = ?', [req.params.id]);
        res.json({ message: 'Promocode deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Record promo code usage
router.post('/record-usage', async (req, res) => {
    try {
        const { code, customerPhone, orderId } = req.body;

        // Get promocode
        const promo = await dbGet('SELECT * FROM promocodes WHERE code = ?', [code.toUpperCase()]);

        if (!promo) {
            return res.status(404).json({ error: 'Promocode not found' });
        }

        // Insert usage record
        await dbRun(
            'INSERT INTO promocode_usage (promocode_id, order_id, customer_phone) VALUES (?, ?, ?)',
            [promo.id, orderId || null, customerPhone || null]
        );

        // Increment usage count in promocodes table
        await dbRun(
            'UPDATE promocodes SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [promo.id]
        );

        res.json({ message: 'Promo usage recorded successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get promo statistics
router.get('/:id/stats', requireAdmin, async (req, res) => {
    try {
        const promo = await dbGet('SELECT * FROM promocodes WHERE id = ?', [req.params.id]);

        if (!promo) {
            return res.status(404).json({ error: 'Promocode not found' });
        }

        // Get usage details with order information
        const usageHistory = await dbAll(
            `SELECT pu.*, o.order_number, o.total, o.customer_name
             FROM promocode_usage pu
             LEFT JOIN orders o ON pu.order_id = o.id
             WHERE pu.promocode_id = ? 
             ORDER BY pu.used_at DESC 
             LIMIT 50`,
            [promo.id]
        );

        // Get unique users count
        const uniqueUsers = await dbGet(
            'SELECT COUNT(DISTINCT customer_phone) as count FROM promocode_usage WHERE promocode_id = ? AND customer_phone IS NOT NULL',
            [promo.id]
        );

        // Get last used date
        const lastUsed = await dbGet(
            'SELECT MAX(used_at) as last_used FROM promocode_usage WHERE promocode_id = ?',
            [promo.id]
        );

        res.json({
            code: promo.code,
            totalUses: promo.usage_count || 0,
            usageLimit: promo.usage_limit,
            maxUsesPerUser: promo.max_uses_per_user,
            uniqueUsers: uniqueUsers.count || 0,
            lastUsed: lastUsed.last_used,
            recentUsage: usageHistory
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
