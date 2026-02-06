import express from 'express';
import { dbAll, dbGet, dbRun } from '../database/db.js';

const router = express.Router();

// Initialize settings table if not exists
const initSettingsTable = async () => {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            site_name TEXT DEFAULT 'AURA',
            logo_text TEXT DEFAULT 'AURA',
            store_description TEXT,
            contact_email TEXT,
            contact_phone TEXT,
            currency TEXT DEFAULT 'UZS',
            currency_symbol TEXT DEFAULT 'Сумм',
            vat_rate REAL DEFAULT 0,
            shipping_cost REAL DEFAULT 0,
            free_shipping_threshold REAL DEFAULT 0,
            enable_taxes INTEGER DEFAULT 0,
            return_policy TEXT,
            privacy_policy TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Insert default settings if not exists
    const existing = await dbGet('SELECT * FROM settings WHERE id = 1');
    if (!existing) {
        await dbRun(`
            INSERT INTO settings (id, site_name, logo_text, currency, currency_symbol, vat_rate, shipping_cost, free_shipping_threshold, enable_taxes)
            VALUES (1, 'AURA', 'AURA', 'UZS', 'Сумм', 0, 0, 0, 0)
        `);
    } else {
        // Add missing columns if they don't exist (for existing databases)
        try {
            await dbRun('ALTER TABLE settings ADD COLUMN logo_text TEXT DEFAULT "AURA"');
        } catch (e) { /* Column already exists */ }
        try {
            await dbRun('ALTER TABLE settings ADD COLUMN store_description TEXT');
        } catch (e) { /* Column already exists */ }
        try {
            await dbRun('ALTER TABLE settings ADD COLUMN contact_email TEXT');
        } catch (e) { /* Column already exists */ }
        try {
            await dbRun('ALTER TABLE settings ADD COLUMN contact_phone TEXT');
        } catch (e) { /* Column already exists */ }
        try {
            await dbRun('ALTER TABLE settings ADD COLUMN enable_taxes INTEGER DEFAULT 0');
        } catch (e) { /* Column already exists */ }
        try {
            await dbRun('ALTER TABLE settings ADD COLUMN return_policy TEXT');
        } catch (e) { /* Column already exists */ }
        try {
            await dbRun('ALTER TABLE settings ADD COLUMN privacy_policy TEXT');
        } catch (e) { /* Column already exists */ }
    }
};

initSettingsTable().catch(console.error);

// Get settings
router.get('/', async (req, res) => {
    try {
        const settings = await dbGet('SELECT * FROM settings WHERE id = 1');
        res.json(settings || {
            site_name: 'AURA',
            currency: 'UZS',
            currency_symbol: 'Сумм',
            vat_rate: 0,
            shipping_cost: 0,
            free_shipping_threshold: 0
        });
    } catch (error) {
        console.error('Failed to get settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update settings
router.put('/', async (req, res) => {
    try {
        const {
            storeName,
            logoText,
            storeDescription,
            contactEmail,
            contactPhone,
            currency,
            currencySymbol,
            freeShippingThreshold,
            flatShippingRate,
            enableTaxes,
            taxPercent,
            returnPolicy,
            privacyPolicy
        } = req.body;

        await dbRun(`
            UPDATE settings SET
                site_name = ?,
                logo_text = ?,
                store_description = ?,
                contact_email = ?,
                contact_phone = ?,
                currency = ?,
                currency_symbol = ?,
                shipping_cost = ?,
                free_shipping_threshold = ?,
                enable_taxes = ?,
                vat_rate = ?,
                return_policy = ?,
                privacy_policy = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `, [
            storeName || 'AURA',
            logoText || 'AURA',
            storeDescription || null,
            contactEmail || null,
            contactPhone || null,
            currency || 'UZS',
            currencySymbol || 'Сумм',
            flatShippingRate || 0,
            freeShippingThreshold || 0,
            enableTaxes ? 1 : 0,
            taxPercent || 0,
            returnPolicy || null,
            privacyPolicy || null
        ]);

        const updated = await dbGet('SELECT * FROM settings WHERE id = 1');
        res.json({ message: 'Settings updated successfully', settings: updated });
    } catch (error) {
        console.error('Failed to update settings:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
