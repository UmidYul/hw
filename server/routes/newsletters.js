import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbAll, dbGet, dbRun } from '../database/db.js';
import { requireAdmin } from '../services/auth.js';
import { sendNewsletterCampaignEmail } from '../services/email.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const newsletterDir = path.join(__dirname, '../../public/images/newsletters');

const allowedCategories = new Set(['promo', 'collection', 'news']);

const initNewslettersTable = async () => {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS newsletters (
            id UUID PRIMARY KEY,
            category TEXT NOT NULL,
            subject TEXT NOT NULL,
            title TEXT NOT NULL,
            subtitle TEXT,
            body TEXT,
            cta_label TEXT,
            cta_url TEXT,
            hero_image TEXT,
            status TEXT DEFAULT 'draft',
            sent_at TIMESTAMPTZ,
            sent_count INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await dbRun('ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS category TEXT');
    await dbRun('ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS subject TEXT');
    await dbRun('ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS title TEXT');
    await dbRun('ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS subtitle TEXT');
    await dbRun('ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS body TEXT');
    await dbRun('ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS cta_label TEXT');
    await dbRun('ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS cta_url TEXT');
    await dbRun('ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS hero_image TEXT');
    await dbRun('ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS status TEXT DEFAULT "draft"');
    await dbRun('ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ');
    await dbRun('ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS sent_count INTEGER DEFAULT 0');
};

initNewslettersTable().catch((error) => {
    console.error('Failed to init newsletters table:', error);
});

const normalizeText = (value) => {
    const trimmed = String(value || '').trim();
    return trimmed.length ? trimmed : null;
};

const normalizeUrl = (value) => {
    const trimmed = String(value || '').trim();
    return trimmed.length ? trimmed : null;
};

const sanitizeCategory = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return allowedCategories.has(normalized) ? normalized : null;
};

const isLocalNewsletterImage = (url) => typeof url === 'string' && url.startsWith('/images/newsletters/');

const getNewsletterImagePath = (url) => {
    if (!isLocalNewsletterImage(url)) return null;
    return path.join(newsletterDir, path.basename(url));
};

const isNewsletterImageUsedElsewhere = async (url, excludeId) => {
    if (!isLocalNewsletterImage(url)) return false;
    if (excludeId) {
        const row = await dbGet('SELECT id FROM newsletters WHERE id <> ? AND hero_image = ? LIMIT 1', [excludeId, url]);
        return !!row;
    }
    const row = await dbGet('SELECT id FROM newsletters WHERE hero_image = ? LIMIT 1', [url]);
    return !!row;
};

const safeDeleteNewsletterImage = async (url, excludeId) => {
    const filePath = getNewsletterImagePath(url);
    if (!filePath) return;
    if (await isNewsletterImageUsedElsewhere(url, excludeId)) return;
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.warn('Failed to delete newsletter image:', error.message);
    }
};

const getStoreMeta = async () => {
    const settings = await dbGet('SELECT site_name, logo_text, contact_email FROM settings LIMIT 1');
    const storeName = settings?.site_name || settings?.logo_text || 'Higher Waist';
    return {
        storeName,
        supportEmail: settings?.contact_email || null
    };
};

router.get('/', requireAdmin, async (req, res) => {
    try {
        const newsletters = await dbAll('SELECT * FROM newsletters ORDER BY created_at DESC');
        res.json(newsletters || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', requireAdmin, async (req, res) => {
    try {
        const newsletter = await dbGet('SELECT * FROM newsletters WHERE id = ?', [req.params.id]);
        if (!newsletter) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.json(newsletter);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', requireAdmin, async (req, res) => {
    try {
        const category = sanitizeCategory(req.body?.category);
        const subject = normalizeText(req.body?.subject);
        const title = normalizeText(req.body?.title);

        if (!category || !subject || !title) {
            return res.status(400).json({ error: 'Category, subject, and title are required' });
        }

        const data = {
            id: crypto.randomUUID(),
            category,
            subject,
            title,
            subtitle: normalizeText(req.body?.subtitle),
            body: normalizeText(req.body?.body),
            ctaLabel: normalizeText(req.body?.cta_label),
            ctaUrl: normalizeUrl(req.body?.cta_url),
            heroImage: normalizeUrl(req.body?.hero_image)
        };

        await dbRun(
            `INSERT INTO newsletters (
                id, category, subject, title, subtitle, body, cta_label, cta_url, hero_image
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            , [
                data.id,
                data.category,
                data.subject,
                data.title,
                data.subtitle,
                data.body,
                data.ctaLabel,
                data.ctaUrl,
                data.heroImage
            ]
        );

        const created = await dbGet('SELECT * FROM newsletters WHERE id = ?', [data.id]);
        res.status(201).json(created);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const existing = await dbGet('SELECT * FROM newsletters WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ error: 'Not found' });
        }

        const resetSentStatus = existing.status === 'sent';

        const category = sanitizeCategory(req.body?.category) || existing.category;
        const subject = normalizeText(req.body?.subject) || existing.subject;
        const title = normalizeText(req.body?.title) || existing.title;

        const newHeroImage = normalizeUrl(req.body?.hero_image);

        const statusValue = resetSentStatus ? 'draft' : existing.status || 'draft';
        const sentAtValue = resetSentStatus ? null : existing.sent_at || null;
        const sentCountValue = resetSentStatus ? 0 : (existing.sent_count || 0);

        await dbRun(
            `UPDATE newsletters SET
                category = ?,
                subject = ?,
                title = ?,
                subtitle = ?,
                body = ?,
                cta_label = ?,
                cta_url = ?,
                hero_image = ?,
                status = ?,
                sent_at = ?,
                sent_count = ?,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                category,
                subject,
                title,
                normalizeText(req.body?.subtitle),
                normalizeText(req.body?.body),
                normalizeText(req.body?.cta_label),
                normalizeUrl(req.body?.cta_url),
                newHeroImage,
                statusValue,
                sentAtValue,
                sentCountValue,
                req.params.id
            ]
        );

        if (existing.hero_image && existing.hero_image !== newHeroImage) {
            await safeDeleteNewsletterImage(existing.hero_image, req.params.id);
        }

        const updated = await dbGet('SELECT * FROM newsletters WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const existing = await dbGet('SELECT * FROM newsletters WHERE id = ?', [req.params.id]);
        await dbRun('DELETE FROM newsletters WHERE id = ?', [req.params.id]);
        if (existing?.hero_image) {
            await safeDeleteNewsletterImage(existing.hero_image, null);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:id/send', requireAdmin, async (req, res) => {
    try {
        const newsletter = await dbGet('SELECT * FROM newsletters WHERE id = ?', [req.params.id]);
        if (!newsletter) {
            return res.status(404).json({ error: 'Not found' });
        }

        const forceSend = req.body?.force === true || req.body?.force === 'true' || req.body?.force === 1 || req.body?.force === '1';
        if (newsletter.status === 'sent' && !forceSend) {
            return res.status(400).json({ error: 'Newsletter already sent' });
        }

        if (!process.env.SMTP_HOST) {
            return res.status(503).json({ error: 'Email service is not configured' });
        }

        const subscribers = await dbAll(
            'SELECT id, email FROM subscribers WHERE status = ? ORDER BY created_at ASC',
            ['active']
        );

        if (!subscribers.length) {
            return res.json({ message: 'No active subscribers', sent: 0, failed: 0, total: 0 });
        }

        const { storeName, supportEmail } = await getStoreMeta();

        let sent = 0;
        let failed = 0;

        for (const subscriber of subscribers) {
            try {
                const ok = await sendNewsletterCampaignEmail({
                    to: subscriber.email,
                    unsubscribeId: subscriber.id,
                    campaign: newsletter,
                    storeName,
                    supportEmail
                });

                if (ok) {
                    sent += 1;
                } else {
                    failed += 1;
                }
            } catch (error) {
                failed += 1;
            }
        }

        await dbRun(
            `UPDATE newsletters
             SET status = 'sent', sent_at = CURRENT_TIMESTAMP, sent_count = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [sent, req.params.id]
        );

        res.json({ message: 'Newsletter sent', sent, failed, total: subscribers.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
