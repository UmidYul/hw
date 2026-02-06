import express from 'express';
import { dbAll, dbGet, dbRun } from '../database/db.js';
import { requireAdmin } from '../services/auth.js';

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
            social_instagram TEXT,
            social_facebook TEXT,
            social_telegram TEXT,
            color_palette JSONB,
            currency TEXT DEFAULT 'UZS',
            currency_symbol TEXT DEFAULT 'Сумм',
            vat_rate REAL DEFAULT 0,
            shipping_cost REAL DEFAULT 0,
            free_shipping_threshold REAL DEFAULT 0,
            enable_taxes BOOLEAN DEFAULT false,
            return_policy TEXT,
            privacy_policy TEXT,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Insert default settings if not exists
    const existing = await dbGet('SELECT * FROM settings WHERE id = 1');
    if (!existing) {
        await dbRun(`
            INSERT INTO settings (id, site_name, logo_text, currency, currency_symbol, vat_rate, shipping_cost, free_shipping_threshold, enable_taxes)
            VALUES (1, 'AURA', 'AURA', 'UZS', 'Сумм', 0, 0, 0, false)
        `);
    } else {
        // Add missing columns if they don't exist (for existing databases)
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_text TEXT DEFAULT "AURA"');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS store_description TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_email TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_phone TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_instagram TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_facebook TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_telegram TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS color_palette JSONB');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS enable_taxes BOOLEAN DEFAULT false');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS return_policy TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS privacy_policy TEXT');
    }

    const enableTaxesColumn = await dbGet(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'settings'
          AND column_name = 'enable_taxes'
    `);

    if (enableTaxesColumn && enableTaxesColumn.data_type !== 'boolean') {
        await dbRun(`
            ALTER TABLE settings
            ALTER COLUMN enable_taxes TYPE BOOLEAN
            USING (CASE WHEN enable_taxes IS NULL THEN false ELSE enable_taxes <> 0 END)
        `);
        await dbRun('ALTER TABLE settings ALTER COLUMN enable_taxes SET DEFAULT false');
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
router.put('/', requireAdmin, async (req, res) => {
    try {
        const {
            storeName,
            logoText,
            storeDescription,
            contactEmail,
            contactPhone,
            socialInstagram,
            socialFacebook,
            socialTelegram,
            colorPalette,
            currency,
            currencySymbol,
            freeShippingThreshold,
            flatShippingRate,
            enableTaxes,
            taxPercent,
            returnPolicy,
            privacyPolicy
        } = req.body;

        const enableTaxesValue = enableTaxes === true
            || enableTaxes === 'true'
            || enableTaxes === 1
            || enableTaxes === '1';

        await dbRun(`
            UPDATE settings SET
                site_name = ?,
                logo_text = ?,
                store_description = ?,
                contact_email = ?,
                contact_phone = ?,
                social_instagram = ?,
                social_facebook = ?,
                social_telegram = ?,
                color_palette = ?,
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
            socialInstagram || null,
            socialFacebook || null,
            socialTelegram || null,
            colorPalette || null,
            currency || 'UZS',
            currencySymbol || 'Сумм',
            flatShippingRate || 0,
            freeShippingThreshold || 0,
            enableTaxesValue,
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
