import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { requireAdmin } from '../services/auth.js';
import { runUploadsCleanup } from '../services/uploads-cleanup.js';

// Compress uploaded image to WebP and delete the original if different
const compressToWebp = async (inputPath, quality = 82, maxSide = 1600) => {
    const ext = path.extname(inputPath).toLowerCase();
    const webpPath = inputPath.slice(0, inputPath.length - ext.length) + '.webp';

    await sharp(inputPath)
        .rotate()
        .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4, smartSubsample: true })
        .toFile(webpPath);

    if (webpPath !== inputPath) {
        await fs.promises.unlink(inputPath).catch(() => { });
    }

    return webpPath;
};

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productUploadDir = path.join(__dirname, '../../public/images/products');
const bannerUploadDir = path.join(__dirname, '../../public/images/banners');
const logoUploadDir = path.join(__dirname, '../../public/images/logo');
const newsletterUploadDir = path.join(__dirname, '../../public/images/newsletters');

const ensureDir = (directory) => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
};

ensureDir(productUploadDir);
ensureDir(bannerUploadDir);
ensureDir(logoUploadDir);
ensureDir(newsletterUploadDir);

const IMAGE_UPLOAD_POLICY = Object.freeze({
    'image/jpeg': {
        extensions: new Set(['.jpg', '.jpeg']),
        signature: (buffer) =>
            buffer.length >= 3
            && buffer[0] === 0xff
            && buffer[1] === 0xd8
            && buffer[2] === 0xff
    },
    'image/png': {
        extensions: new Set(['.png']),
        signature: (buffer) =>
            buffer.length >= 8
            && buffer[0] === 0x89
            && buffer[1] === 0x50
            && buffer[2] === 0x4e
            && buffer[3] === 0x47
            && buffer[4] === 0x0d
            && buffer[5] === 0x0a
            && buffer[6] === 0x1a
            && buffer[7] === 0x0a
    },
    'image/webp': {
        extensions: new Set(['.webp']),
        signature: (buffer) =>
            buffer.length >= 12
            && buffer.toString('ascii', 0, 4) === 'RIFF'
            && buffer.toString('ascii', 8, 12) === 'WEBP'
    },
    'image/gif': {
        extensions: new Set(['.gif']),
        signature: (buffer) => {
            const signature = buffer.toString('ascii', 0, 6);
            return signature === 'GIF87a' || signature === 'GIF89a';
        }
    },
    'image/x-icon': {
        extensions: new Set(['.ico']),
        signature: (buffer) =>
            buffer.length >= 4
            && buffer[0] === 0x00
            && buffer[1] === 0x00
            && buffer[2] === 0x01
            && buffer[3] === 0x00
    },
    'image/vnd.microsoft.icon': {
        extensions: new Set(['.ico']),
        signature: (buffer) =>
            buffer.length >= 4
            && buffer[0] === 0x00
            && buffer[1] === 0x00
            && buffer[2] === 0x01
            && buffer[3] === 0x00
    }
});

const getImagePolicy = (mimetype) => IMAGE_UPLOAD_POLICY[String(mimetype || '').toLowerCase()] || null;

const getSafeUploadExtension = (file) => {
    const policy = getImagePolicy(file?.mimetype);
    if (!policy) return null;

    const originalExt = path.extname(String(file?.originalname || '')).toLowerCase();
    if (originalExt && policy.extensions.has(originalExt)) {
        return originalExt;
    }

    return Array.from(policy.extensions)[0] || null;
};

const readFileSignature = async (filePath, maxBytes = 16) => {
    const fileHandle = await fs.promises.open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(maxBytes);
        const result = await fileHandle.read(buffer, 0, maxBytes, 0);
        return buffer.subarray(0, result.bytesRead);
    } finally {
        await fileHandle.close();
    }
};

const deleteUploadedFileSilently = async (filePath) => {
    if (!filePath) return;
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        // Ignore cleanup errors.
    }
};

const ensureValidUploadedImage = async (file) => {
    if (!file?.path || !file?.mimetype) return false;
    const policy = getImagePolicy(file.mimetype);
    if (!policy) return false;

    try {
        const signature = await readFileSignature(file.path);
        return policy.signature(signature);
    } catch (error) {
        return false;
    }
};

const createStorage = (destination, prefix) => multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, destination);
    },
    filename: (req, file, cb) => {
        const ext = getSafeUploadExtension(file) || '.jpg';
        const stamp = Date.now().toString(36);
        const rand = Math.random().toString(36).slice(2, 8);
        cb(null, `${prefix}-${stamp}-${rand}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const policy = getImagePolicy(file?.mimetype);
    if (!policy) {
        return cb(new Error('Only JPG, PNG, WEBP, GIF, and ICO images are allowed'));
    }

    const ext = path.extname(String(file?.originalname || '')).toLowerCase();
    if (ext && !policy.extensions.has(ext)) {
        return cb(new Error('File extension does not match MIME type'));
    }

    return cb(null, true);
};

const createUploader = (destination, prefix) => multer({
    storage: createStorage(destination, prefix),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadSingle = (destination, prefix) => {
    const uploader = createUploader(destination, prefix).single('image');
    return (req, res, next) => {
        uploader(req, res, (error) => {
            if (!error) {
                return next();
            }
            return res.status(400).json({ success: false, message: error.message || 'Upload failed' });
        });
    };
};

const handleImageUpload = (urlPrefix, compressOptions = {}) => async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Файл не загружен' });
    }

    const isValid = await ensureValidUploadedImage(req.file);
    if (!isValid) {
        await deleteUploadedFileSilently(req.file.path);
        return res.status(400).json({ success: false, message: 'Некорректный формат изображения' });
    }

    try {
        const { quality = 82, maxSide = 1600 } = compressOptions;
        const webpPath = await compressToWebp(req.file.path, quality, maxSide);
        const filename = path.basename(webpPath);
        return res.json({ success: true, url: `${urlPrefix}/${filename}` });
    } catch (err) {
        await deleteUploadedFileSilently(req.file.path);
        return res.status(500).json({ success: false, message: 'Ошибка при обработке изображения: ' + err.message });
    }
};

router.post('/products', requireAdmin, uploadSingle(productUploadDir, 'product'), handleImageUpload('/images/products', { quality: 82, maxSide: 1600 }));

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

router.post('/banners', requireAdmin, uploadSingle(bannerUploadDir, 'banner'), handleImageUpload('/images/banners', { quality: 85, maxSide: 1920 }));
router.post('/newsletters', requireAdmin, uploadSingle(newsletterUploadDir, 'newsletter'), handleImageUpload('/images/newsletters', { quality: 82, maxSide: 1400 }));
router.post('/logo', requireAdmin, uploadSingle(logoUploadDir, 'logo'), handleImageUpload('/images/logo', { quality: 88, maxSide: 400 }));

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

router.post('/newsletters/delete', requireAdmin, (req, res) => {
    try {
        const { url } = req.body || {};
        if (!url || typeof url !== 'string' || !url.startsWith('/images/newsletters/')) {
            return res.status(400).json({ success: false, message: 'Некорректный URL' });
        }

        const filename = path.basename(url);
        const filePath = path.join(newsletterUploadDir, filename);
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
