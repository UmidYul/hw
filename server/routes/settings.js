import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbGet, dbRun } from '../database/db.js';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logoUploadDir = path.join(__dirname, '../../public/images/logo');

// Initialize settings table if not exists
const initSettingsTable = async () => {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS settings (
            id UUID PRIMARY KEY,
            site_name TEXT DEFAULT 'Higher Waist',
            logo_text TEXT DEFAULT 'Higher Waist',
            store_description TEXT,
            contact_email TEXT,
            contact_phone TEXT,
            logo_icon TEXT,
            social_instagram TEXT,
            social_facebook TEXT,
            social_telegram TEXT,
            social_tiktok TEXT,
            social_youtube TEXT,
            social_whatsapp TEXT,
            color_palette JSONB,
            sizes_list JSONB,
            size_table TEXT,
            currency TEXT DEFAULT 'UZS',
            currency_symbol TEXT DEFAULT 'Сумм',
            vat_rate REAL DEFAULT 0,
            shipping_cost REAL DEFAULT 0,
            free_shipping_threshold REAL DEFAULT 0,
            enable_taxes INTEGER DEFAULT 0,
            return_policy TEXT,
            privacy_policy TEXT,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Insert default settings if not exists
    const existing = await dbGet('SELECT * FROM settings LIMIT 1');
    if (!existing) {
        const settingsId = crypto.randomUUID();
        await dbRun(
            `INSERT INTO settings (id, site_name, logo_text, currency, currency_symbol, vat_rate, shipping_cost, free_shipping_threshold, enable_taxes)
             VALUES (?, 'Higher Waist', 'Higher Waist', 'UZS', 'Сумм', 0, 0, 0, 0)`
            , [settingsId]
        );
    } else {
        // Add missing columns if they don't exist (for existing databases)
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_text TEXT DEFAULT "Higher Waist"');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS store_description TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_email TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_phone TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_icon TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_instagram TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_facebook TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_telegram TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_tiktok TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_youtube TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_whatsapp TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS color_palette JSONB');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS sizes_list JSONB');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS size_table TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS enable_taxes INTEGER DEFAULT 0');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS return_policy TEXT');
        await dbRun('ALTER TABLE settings ADD COLUMN IF NOT EXISTS privacy_policy TEXT');
    }
};

initSettingsTable().catch(console.error);

// Get settings
router.get('/', async (req, res) => {
    try {
        const settings = await dbGet('SELECT * FROM settings LIMIT 1');
        res.json(settings || {
            site_name: 'Higher Waist',
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
            logoIcon,
            socialInstagram,
            socialFacebook,
            socialTelegram,
            socialTiktok,
            socialYoutube,
            socialWhatsapp,
            colorPalette,
            sizesList,
            sizeTable,
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

        const enableTaxesDbValue = enableTaxesValue ? 1 : 0;

        let settings = await dbGet('SELECT * FROM settings LIMIT 1');
        if (!settings) {
            const settingsId = crypto.randomUUID();
            await dbRun(
                'INSERT INTO settings (id, site_name, logo_text) VALUES (?, ?, ?)',
                [settingsId, storeName || 'Higher Waist', logoText || 'Higher Waist']
            );
            settings = await dbGet('SELECT * FROM settings LIMIT 1');
        }

        const previousLogo = settings?.logo_icon || '';

        await dbRun(`
            UPDATE settings SET
                site_name = ?,
                logo_text = ?,
                store_description = ?,
                contact_email = ?,
                contact_phone = ?,
            logo_icon = ?,
                social_instagram = ?,
                social_facebook = ?,
                social_telegram = ?,
                social_tiktok = ?,
                social_youtube = ?,
                social_whatsapp = ?,
                color_palette = ?,
                sizes_list = ?,
                size_table = ?,
                currency = ?,
                currency_symbol = ?,
                shipping_cost = ?,
                free_shipping_threshold = ?,
                enable_taxes = ?,
                vat_rate = ?,
                return_policy = ?,
                privacy_policy = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            storeName || 'Higher Waist',
            logoText || 'Higher Waist',
            storeDescription || null,
            contactEmail || null,
            contactPhone || null,
            logoIcon || null,
            socialInstagram || null,
            socialFacebook || null,
            socialTelegram || null,
            socialTiktok || null,
            socialYoutube || null,
            socialWhatsapp || null,
            colorPalette || null,
            sizesList || null,
            sizeTable || null,
            currency || 'UZS',
            currencySymbol || 'Сумм',
            flatShippingRate || 0,
            freeShippingThreshold || 0,
            enableTaxesDbValue,
            taxPercent || 0,
            returnPolicy || null,
            privacyPolicy || null,
            settings.id
        ]);

        if (previousLogo
            && previousLogo !== (logoIcon || '')
            && previousLogo.startsWith('/images/logo/')) {
            const filename = path.basename(previousLogo);
            const filePath = path.join(logoUploadDir, filename);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (error) {
                    console.warn('Failed to delete old logo icon:', error.message);
                }
            }
        }

        const updated = await dbGet('SELECT * FROM settings LIMIT 1');
        res.json({ message: 'Settings updated successfully', settings: updated });
    } catch (error) {
        console.error('Failed to update settings:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
