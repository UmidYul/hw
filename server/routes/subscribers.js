import express from 'express';
import crypto from 'crypto';
import { dbGet, dbRun } from '../database/db.js';
import { sendNewsletterWelcomeEmail } from '../services/email.js';

const router = express.Router();

const initSubscribersTable = async () => {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS subscribers (
            id UUID PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'active',
            source TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await dbRun('ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT "active"');
    await dbRun('ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS source TEXT');
    await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_lower_uidx ON subscribers (LOWER(email))');
};

initSubscribersTable().catch((error) => {
    console.error('Failed to init subscribers table:', error);
});

const isValidEmail = (value) => {
    const email = String(value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

router.post('/', async (req, res) => {
    try {
        const { email, source } = req.body;
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email' });
        }

        const normalized = String(email).trim().toLowerCase();

        const existing = await dbGet('SELECT * FROM subscribers WHERE LOWER(email) = ?', [normalized]);
        if (existing && existing.status === 'active') {
            return res.status(200).json({
                message: 'Already subscribed',
                alreadySubscribed: true,
                subscriber: existing
            });
        }

        if (existing) {
            await dbRun(
                `UPDATE subscribers
                 SET email = ?, status = 'active', source = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [normalized, source || 'website', existing.id]
            );
        } else {
            const subscriberId = crypto.randomUUID();
            await dbRun(
                `INSERT INTO subscribers (id, email, status, source)
                 VALUES (?, ?, 'active', ?)
                 ON CONFLICT (email)
                 DO UPDATE SET status = 'active', source = EXCLUDED.source, updated_at = CURRENT_TIMESTAMP`,
                [subscriberId, normalized, source || 'website']
            );
        }

        const subscriber = await dbGet('SELECT * FROM subscribers WHERE LOWER(email) = ?', [normalized]);

        try {
            await sendNewsletterWelcomeEmail({
                to: normalized,
                unsubscribeId: subscriber?.id
            });
        } catch (error) {
            console.error('Failed to send welcome email:', error);
        }

        res.status(201).json({ message: 'Subscribed', alreadySubscribed: false, subscriber });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/unsubscribe', async (req, res) => {
    try {
        const id = String(req.query.id || '').trim();
        if (!id) {
            return res.status(400).send('Некорректная ссылка отписки.');
        }

        await dbRun(
            `UPDATE subscribers
             SET status = 'unsubscribed', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [id]
        );

        res.send(`
            <div style="font-family: Arial, sans-serif; color: #2d2d2d; padding: 24px;">
                <h2 style="margin: 0 0 12px;">Вы отписались от рассылки</h2>
                <p style="margin: 0;">Если это ошибка, вы всегда можете подписаться снова на сайте.</p>
            </div>
        `);
    } catch (error) {
        res.status(500).send('Не удалось обработать запрос.');
    }
});

export default router;
