import express from 'express';
import { dbGet, dbRun } from '../database/db.js';
import { sendNewsletterWelcomeEmail } from '../services/email.js';

const router = express.Router();

const initSubscribersTable = async () => {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS subscribers (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'active',
            source TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await dbRun('ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT "active"');
    await dbRun('ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS source TEXT');
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

        await dbRun(
            `INSERT INTO subscribers (email, status, source)
             VALUES (?, 'active', ?)
             ON CONFLICT (email)
             DO UPDATE SET status = 'active', source = EXCLUDED.source, updated_at = CURRENT_TIMESTAMP`,
            [normalized, source || 'website']
        );

        const subscriber = await dbGet('SELECT * FROM subscribers WHERE email = ?', [normalized]);

        try {
            await sendNewsletterWelcomeEmail({ to: normalized });
        } catch (error) {
            console.error('Failed to send welcome email:', error);
        }

        res.status(201).json({ message: 'Subscribed', subscriber });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
