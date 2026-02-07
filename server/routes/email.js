import express from 'express';
import { requireAdmin } from '../services/auth.js';
import { sendTestEmail } from '../services/email.js';

const router = express.Router();

router.post('/test', requireAdmin, async (req, res) => {
    try {
        const { to } = req.body || {};
        if (!to) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const result = await sendTestEmail({ to });
        if (!result) {
            return res.status(503).json({ error: 'Email service is not configured' });
        }

        res.json({ message: 'Test email sent' });
    } catch (error) {
        console.error('Failed to send test email:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
