import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbAll } from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productDir = path.join(__dirname, '../../public/images/products');
const bannerDir = path.join(__dirname, '../../public/images/banners');

const listFiles = (dir) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => entry.name);
};

const collectUsedProductFiles = async () => {
    const rows = await dbAll('SELECT images FROM products');
    const used = new Set();

    rows.forEach(row => {
        let images = [];
        if (Array.isArray(row.images)) {
            images = row.images;
        } else if (typeof row.images === 'string') {
            try {
                images = JSON.parse(row.images);
            } catch (error) {
                images = [];
            }
        }

        images.forEach(url => {
            if (typeof url === 'string' && url.startsWith('/images/products/')) {
                used.add(path.basename(url));
            }
        });
    });

    return used;
};

const collectUsedBannerFiles = async () => {
    const rows = await dbAll('SELECT image FROM banners');
    const used = new Set();

    rows.forEach(row => {
        const url = row.image;
        if (typeof url === 'string' && url.startsWith('/images/banners/')) {
            used.add(path.basename(url));
        }
    });

    return used;
};

const cleanupDirectory = (dir, usedFiles, baseUrl) => {
    const files = listFiles(dir);
    const removedUrls = [];

    files.forEach(file => {
        if (!usedFiles.has(file)) {
            try {
                fs.unlinkSync(path.join(dir, file));
                removedUrls.push(`${baseUrl}/${file}`);
            } catch (error) {
                console.warn('Failed to remove file:', file, error.message);
            }
        }
    });

    return { scanned: files.length, removed: removedUrls.length, removedUrls };
};

export const runUploadsCleanup = async ({ type = 'all' } = {}) => {
    const result = {};

    if (type === 'all' || type === 'products') {
        const usedProductFiles = await collectUsedProductFiles();
        result.products = cleanupDirectory(productDir, usedProductFiles, '/images/products');
    }

    if (type === 'all' || type === 'banners') {
        const usedBannerFiles = await collectUsedBannerFiles();
        result.banners = cleanupDirectory(bannerDir, usedBannerFiles, '/images/banners');
    }

    return result;
};
