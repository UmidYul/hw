import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../../public/images/products');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const stamp = Date.now().toString(36);
        const rand = Math.random().toString(36).slice(2, 8);
        cb(null, `product-${stamp}-${rand}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed'));
    }
    return cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/products', requireAdmin, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Файл не загружен' });
    }

    const url = `/images/products/${req.file.filename}`;
    return res.json({ success: true, url });
});

export default router;
