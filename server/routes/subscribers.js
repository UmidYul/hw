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
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Вы отписались от подписки</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fraunces:wght@600;700&display=swap" rel="stylesheet">
                <style>
                    :root {
                        color-scheme: light;
                    }

                    * {
                        box-sizing: border-box;
                    }

                    body {
                        margin: 0;
                        min-height: 100vh;
                        font-family: "DM Sans", "Segoe UI", sans-serif;
                        color: #262626;
                        background: radial-gradient(1200px 600px at 10% -10%, #fff0db 0%, transparent 60%),
                            radial-gradient(900px 500px at 100% 0%, #e9f0ff 0%, transparent 55%),
                            #f7f4f0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 32px 16px;
                    }

                    .card {
                        width: min(560px, 100%);
                        background: #ffffff;
                        border: 1px solid #efe7de;
                        border-radius: 24px;
                        box-shadow: 0 18px 45px rgba(28, 24, 20, 0.12);
                        overflow: hidden;
                    }

                    .card-header {
                        padding: 32px 32px 16px;
                        background: linear-gradient(135deg, #1f1f1f, #3b2f20);
                        color: #f7f0e7;
                    }

                    .brand {
                        font-size: 12px;
                        letter-spacing: 3px;
                        text-transform: uppercase;
                        color: #e6d4bd;
                        margin-bottom: 18px;
                    }

                    .title {
                        font-family: "Fraunces", "Times New Roman", serif;
                        font-size: 30px;
                        font-weight: 700;
                        margin: 0 0 8px;
                    }

                    .subtitle {
                        margin: 0;
                        color: #f1e9df;
                        font-size: 15px;
                        line-height: 1.5;
                    }

                    .card-body {
                        padding: 28px 32px 32px;
                        background: #ffffff;
                    }

                    .icon-wrap {
                        width: 56px;
                        height: 56px;
                        border-radius: 16px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        background: #f8f1e6;
                        color: #7a4e1b;
                        margin-bottom: 18px;
                    }

                    .message {
                        font-size: 16px;
                        line-height: 1.6;
                        margin: 0 0 18px;
                        color: #3a3a3a;
                    }

                    .note {
                        font-size: 14px;
                        line-height: 1.6;
                        color: #6d6d6d;
                        margin: 0 0 24px;
                    }

                    .actions {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 12px;
                    }

                    .btn {
                        text-decoration: none;
                        padding: 12px 20px;
                        border-radius: 999px;
                        font-size: 14px;
                        font-weight: 600;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        transition: transform 0.2s ease, box-shadow 0.2s ease;
                    }

                    .btn-primary {
                        background: #1f1f1f;
                        color: #ffffff;
                        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
                    }

                    .btn-secondary {
                        border: 1px solid #e6d6c4;
                        color: #7a4e1b;
                        background: #fff8ef;
                    }

                    .btn:hover {
                        transform: translateY(-1px);
                    }

                    .footer {
                        padding: 18px 32px 28px;
                        background: #fffaf3;
                        color: #9b8a78;
                        font-size: 12px;
                        border-top: 1px solid #f0e6dc;
                    }

                    @media (max-width: 480px) {
                        .card-header,
                        .card-body,
                        .footer {
                            padding-left: 22px;
                            padding-right: 22px;
                        }

                        .title {
                            font-size: 26px;
                        }
                    }
                </style>
            </head>
            <body>
                <main class="card" role="main">
                    <div class="card-header">
                        <div class="brand">Higher Waist</div>
                        <h1 class="title">Вы отписались от подписки</h1>
                        <p class="subtitle">Мы больше не будем присылать вам письма от этой рассылки.</p>
                    </div>
                    <div class="card-body">
                        <div class="icon-wrap" aria-hidden="true">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 12.5L9 17.5L20 6.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                        <p class="message">Статус подписки обновлен. Если вы передумаете, можно подписаться снова.</p>
                        <p class="note">Мы ценим ваш интерес и сохраняем доступ к новостям, акциям и новым коллекциям.</p>
                        <div class="actions">
                            <a class="btn btn-primary" href="/">Вернуться на сайт</a>
                            <a class="btn btn-secondary" href="/">Подписаться снова</a>
                        </div>
                    </div>
                    <div class="footer">Если вы получили это письмо по ошибке, просто закройте страницу.</div>
                </main>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Не удалось обработать запрос.');
    }
});

export default router;
