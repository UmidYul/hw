import express from 'express';
import crypto from 'crypto';
import { dbAll, dbGet, dbRun } from '../database/db.js';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();

const allowedPromoTypes = new Set(['percent', 'fixed']);

const normalizePromoCode = (value) => String(value || '').trim().toUpperCase();

const normalizeText = (value) => {
    const text = String(value || '').trim();
    return text || null;
};

const toNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const formatDateForDb = (isoDate) => {
    if (!isoDate) return null;
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed.toISOString();
};

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
        const normalizedCode = normalizePromoCode(req.body?.code);
        const amount = Math.max(0, toNumber(req.body?.amount, 0));
        const customerIdentifier = normalizeText(req.body?.customerIdentifier); // email or phone

        if (!normalizedCode) {
            return res.status(400).json({ valid: false, message: 'Promo code is required' });
        }

        const sql = `
      SELECT * FROM promocodes 
      WHERE code = ? 
    AND is_active = true
      AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
      AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
      AND (usage_limit IS NULL OR usage_count < usage_limit)
    `;

        const promo = await dbGet(sql, [normalizedCode]);

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
            const usageCount = Math.max(0, Math.trunc(toNumber(usageResult?.count, 0)));
            const maxUsesPerUser = Math.max(0, Math.trunc(toNumber(promo.max_uses_per_user, 0)));

            if (usageCount >= maxUsesPerUser) {
                return res.json({
                    valid: false,
                    message: `Вы уже использовали этот промокод максимальное количество раз (${maxUsesPerUser})`
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
        const normalizedCode = normalizePromoCode(code);
        const normalizedType = normalizeText(type)?.toLowerCase() || '';
        const normalizedValue = toNumber(value, 0);
        const normalizedMinAmount = Math.max(0, toNumber(minAmount, 0));
        const normalizedUsageLimit = usageLimit === null || usageLimit === undefined || usageLimit === ''
            ? null
            : Math.max(0, Math.trunc(toNumber(usageLimit, 0)));
        const normalizedMaxUsesPerUser = maxUsesPerUser === null || maxUsesPerUser === undefined || maxUsesPerUser === ''
            ? null
            : Math.max(0, Math.trunc(toNumber(maxUsesPerUser, 0)));
        const normalizedStartDate = formatDateForDb(startDate);
        const normalizedEndDate = formatDateForDb(endDate);

        if (!normalizedCode) {
            return res.status(400).json({ error: 'Promocode is required' });
        }
        if (!allowedPromoTypes.has(normalizedType)) {
            return res.status(400).json({ error: 'Invalid promocode type' });
        }
        if (normalizedValue <= 0) {
            return res.status(400).json({ error: 'Promocode value must be greater than 0' });
        }
        if ((startDate && !normalizedStartDate) || (endDate && !normalizedEndDate)) {
            return res.status(400).json({ error: 'Invalid promo date format' });
        }
        if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
            return res.status(400).json({ error: 'Start date must be before end date' });
        }

        const promoId = crypto.randomUUID();
        const sql = `
            INSERT INTO promocodes (id, code, type, value, min_amount, exclude_sale, usage_limit, max_uses_per_user, start_date, end_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        `;

        const result = await dbRun(sql, [
            promoId,
            normalizedCode,
            normalizedType,
            normalizedValue,
            normalizedMinAmount,
            !!excludeSale,
            normalizedUsageLimit,
            normalizedMaxUsesPerUser,
            normalizedStartDate,
            normalizedEndDate
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
        const normalizedCode = normalizePromoCode(code);
        const normalizedType = normalizeText(type)?.toLowerCase() || '';
        const normalizedValue = toNumber(value, 0);
        const normalizedMinAmount = Math.max(0, toNumber(minAmount, 0));
        const normalizedUsageLimit = usageLimit === null || usageLimit === undefined || usageLimit === ''
            ? null
            : Math.max(0, Math.trunc(toNumber(usageLimit, 0)));
        const normalizedMaxUsesPerUser = maxUsesPerUser === null || maxUsesPerUser === undefined || maxUsesPerUser === ''
            ? null
            : Math.max(0, Math.trunc(toNumber(maxUsesPerUser, 0)));
        const normalizedStartDate = formatDateForDb(startDate);
        const normalizedEndDate = formatDateForDb(endDate);
        const normalizedIsActive = isActive === true
            || isActive === 1
            || isActive === '1'
            || String(isActive || '').toLowerCase() === 'true';

        if (!normalizedCode) {
            return res.status(400).json({ error: 'Promocode is required' });
        }
        if (!allowedPromoTypes.has(normalizedType)) {
            return res.status(400).json({ error: 'Invalid promocode type' });
        }
        if (normalizedValue <= 0) {
            return res.status(400).json({ error: 'Promocode value must be greater than 0' });
        }
        if ((startDate && !normalizedStartDate) || (endDate && !normalizedEndDate)) {
            return res.status(400).json({ error: 'Invalid promo date format' });
        }
        if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
            return res.status(400).json({ error: 'Start date must be before end date' });
        }

        const sql = `
      UPDATE promocodes SET
        code = ?, type = ?, value = ?, min_amount = ?,
        exclude_sale = ?, usage_limit = ?, max_uses_per_user = ?, is_active = ?,
        start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

        await dbRun(sql, [
            normalizedCode,
            normalizedType,
            normalizedValue,
            normalizedMinAmount,
            !!excludeSale,
            normalizedUsageLimit,
            normalizedMaxUsesPerUser,
            normalizedIsActive,
            normalizedStartDate,
            normalizedEndDate,
            req.params.id
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
router.post('/record-usage', requireAdmin, async (req, res) => {
    try {
        const code = normalizePromoCode(req.body?.code);
        const customerPhone = normalizeText(req.body?.customerPhone);
        const orderId = normalizeText(req.body?.orderId);

        if (!code) {
            return res.status(400).json({ error: 'Promocode is required' });
        }

        // Get promocode
        const promo = await dbGet('SELECT * FROM promocodes WHERE code = ?', [code]);

        if (!promo) {
            return res.status(404).json({ error: 'Promocode not found' });
        }

        // Insert usage record
        const usageId = crypto.randomUUID();
        await dbRun(
            'INSERT INTO promocode_usage (id, promocode_id, order_id, customer_phone) VALUES (?, ?, ?, ?)',
            [usageId, promo.id, orderId || null, customerPhone || null]
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
