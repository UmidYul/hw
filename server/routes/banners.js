import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbAll, dbGet, dbRun } from '../database/db.js';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bannerDir = path.join(__dirname, '../../public/images/banners');

const getBannerFilePath = (url) => {
    if (!url || typeof url !== 'string' || !url.startsWith('/images/banners/')) {
        return null;
    }
    const filename = path.basename(url);
    return path.join(bannerDir, filename);
};

const isBannerImageUsedElsewhere = async (url, excludeId) => {
    if (!url || typeof url !== 'string') return false;
    if (!excludeId) {
        const row = await dbGet('SELECT id FROM banners WHERE image = ? LIMIT 1', [url]);
        return !!row;
    }
    const row = await dbGet('SELECT id FROM banners WHERE id <> ? AND image = ? LIMIT 1', [excludeId, url]);
    return !!row;
};

const safeDeleteBannerImage = async (url, excludeId) => {
    const filePath = getBannerFilePath(url);
    if (!filePath) return;
    if (await isBannerImageUsedElsewhere(url, excludeId)) return;
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.warn('Failed to delete banner image:', error.message);
    }
};

// Get all banners
router.get('/', async (req, res) => {
    try {
        const { placement, active } = req.query;

        let sql = 'SELECT * FROM banners';
        const params = [];
        const conditions = [];

        if (placement) {
            conditions.push('placement = ?');
            params.push(placement);
        }

        if (active !== undefined) {
            conditions.push('is_active = ?');
            params.push(active === 'true');
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY order_index ASC, created_at DESC';

        const banners = await dbAll(sql, params);
        res.json(banners);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get active banners for frontend
router.get('/active', async (req, res) => {
    try {
        const sql = `
      SELECT * FROM banners 
    WHERE is_active = true 
      AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
      AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
      ORDER BY order_index ASC
    `;

        const banners = await dbAll(sql);
        res.json(banners);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get banner by ID
router.get('/:id', async (req, res) => {
    try {
        const banner = await dbGet('SELECT * FROM banners WHERE id = ?', [req.params.id]);

        if (!banner) {
            return res.status(404).json({ error: 'Banner not found' });
        }

        res.json(banner);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create banner
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { title, subtitle, description, buttonText, buttonLink, image, backgroundColor, textColor, placement, isActive, startDate, endDate, orderIndex } = req.body;

        const bannerId = crypto.randomUUID();
        const sql = `
            INSERT INTO banners (
                id, title, subtitle, description, button_text, button_link,
                image, background_color, text_color, placement, is_active,
                start_date, end_date, order_index
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        `;

        const result = await dbRun(sql, [
            bannerId,
            title, subtitle || null, description || null,
            buttonText || null, buttonLink || null,
            image || null,
            backgroundColor || '#F5F5F5',
            textColor || '#2D2D2D',
            placement || 'hero',
            isActive !== undefined ? !!isActive : true,
            startDate || null, endDate || null,
            orderIndex || 0
        ]);

        res.status(201).json({ id: result.id, message: 'Banner created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update banner
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { title, subtitle, description, buttonText, buttonLink, image, backgroundColor, textColor, placement, isActive, startDate, endDate, orderIndex } = req.body;

        const existing = await dbGet('SELECT * FROM banners WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ error: 'Banner not found' });
        }

        const sql = `
      UPDATE banners SET
        title = ?, subtitle = ?, description = ?, button_text = ?,
        button_link = ?, image = ?, background_color = ?, text_color = ?,
        placement = ?, is_active = ?, start_date = ?, end_date = ?,
        order_index = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

        await dbRun(sql, [
            title, subtitle || null, description || null,
            buttonText || null, buttonLink || null, image || null,
            backgroundColor || '#F5F5F5', textColor || '#2D2D2D',
            placement || 'hero', isActive !== undefined ? !!isActive : true,
            startDate || null, endDate || null, orderIndex || 0,
            req.params.id
        ]);

        if (existing.image && existing.image !== image) {
            await safeDeleteBannerImage(existing.image, req.params.id);
        }

        res.json({ message: 'Banner updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete banner
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const existing = await dbGet('SELECT * FROM banners WHERE id = ?', [req.params.id]);
        await dbRun('DELETE FROM banners WHERE id = ?', [req.params.id]);
        if (existing?.image) {
            await safeDeleteBannerImage(existing.image, null);
        }
        res.json({ message: 'Banner deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
