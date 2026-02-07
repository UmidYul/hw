import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAdmin } from '../services/auth.js';
import { runUploadsCleanup } from '../services/uploads-cleanup.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productUploadDir = path.join(__dirname, '../../public/images/products');
const bannerUploadDir = path.join(__dirname, '../../public/images/banners');
if (!fs.existsSync(productUploadDir)) {
    fs.mkdirSync(productUploadDir, { recursive: true });
}
if (!fs.existsSync(bannerUploadDir)) {
    fs.mkdirSync(bannerUploadDir, { recursive: true });
}

const createStorage = (destination, prefix) => multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, destination);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const stamp = Date.now().toString(36);
        const rand = Math.random().toString(36).slice(2, 8);
        cb(null, `${prefix}-${stamp}-${rand}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed'));
    }
    return cb(null, true);
};

const createUploader = (destination, prefix) => multer({
    storage: createStorage(destination, prefix),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/products', requireAdmin, createUploader(productUploadDir, 'product').single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Файл не загружен' });
    }

    const url = `/images/products/${req.file.filename}`;
    return res.json({ success: true, url });
});

router.post('/products/delete', requireAdmin, (req, res) => {
    try {
        const { url } = req.body || {};
        if (!url || typeof url !== 'string' || !url.startsWith('/images/products/')) {
            return res.status(400).json({ success: false, message: 'Некорректный URL' });
        }

        const filename = path.basename(url);
        const filePath = path.join(productUploadDir, filename);
        if (!fs.existsSync(filePath)) {
            return res.json({ success: true, removed: false });
        }

        fs.unlinkSync(filePath);
        return res.json({ success: true, removed: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/banners', requireAdmin, createUploader(bannerUploadDir, 'banner').single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Файл не загружен' });
    }

    const url = `/images/banners/${req.file.filename}`;
    return res.json({ success: true, url });
});

router.post('/banners/delete', requireAdmin, (req, res) => {
    try {
        const { url } = req.body || {};
        if (!url || typeof url !== 'string' || !url.startsWith('/images/banners/')) {
            return res.status(400).json({ success: false, message: 'Некорректный URL' });
        }

        const filename = path.basename(url);
        const filePath = path.join(bannerUploadDir, filename);
        if (!fs.existsSync(filePath)) {
            return res.json({ success: true, removed: false });
        }

        fs.unlinkSync(filePath);
        return res.json({ success: true, removed: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/cleanup', requireAdmin, async (req, res) => {
    try {
        const type = req.body?.type || req.query?.type || 'all';
        const result = await runUploadsCleanup({ type });
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
