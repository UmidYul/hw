import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');
const productsDir = path.join(projectRoot, 'public/images/products');

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const rewriteDbToWebp = args.includes('--rewrite-db-webp');
const qualityArg = args.find((arg) => arg.startsWith('--quality='));
const maxSideArg = args.find((arg) => arg.startsWith('--max-side='));
const quality = Math.max(1, Math.min(100, parseInt((qualityArg || '').split('=')[1], 10) || 92));
const maxSide = Math.max(400, parseInt((maxSideArg || '').split('=')[1], 10) || 2200);

const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const findLocalFiles = async (directory) => {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => supportedExtensions.has(path.extname(name).toLowerCase()));
};

const optimizeImageBuffer = async (inputPath, extension) => {
    const pipeline = sharp(inputPath)
        .rotate()
        .resize({
            width: maxSide,
            height: maxSide,
            fit: 'inside',
            withoutEnlargement: true
        });

    if (extension === '.jpg' || extension === '.jpeg') {
        return pipeline
            .jpeg({
                quality,
                mozjpeg: true,
                progressive: true
            })
            .toBuffer();
    }

    if (extension === '.png') {
        return pipeline
            .png({
                compressionLevel: 9,
                progressive: true,
                palette: false
            })
            .toBuffer();
    }

    return pipeline
        .webp({
            quality,
            effort: 5,
            smartSubsample: true
        })
        .toBuffer();
};

const getFileSize = async (filePath) => {
    const stat = await fs.promises.stat(filePath);
    return stat.size;
};

const hasPostgresConfig = () => !!(
    process.env.DATABASE_URL
    || (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && typeof process.env.PGPASSWORD === 'string')
);

const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

const isLocalProductImage = (url) => typeof url === 'string' && url.startsWith('/images/products/');

async function main() {
    console.log(`Mode: ${applyChanges ? 'apply' : 'dry-run'}`);
    console.log(`Quality: ${quality}, Max side: ${maxSide}px, rewrite-db-webp: ${rewriteDbToWebp}`);

    if (!fs.existsSync(productsDir)) {
        throw new Error(`Products directory not found: ${productsDir}`);
    }

    const filenames = await findLocalFiles(productsDir);

    let scanned = 0;
    let optimized = 0;
    let skipped = 0;
    let errors = 0;
    let totalSavedBytes = 0;

    for (const filename of filenames) {
        scanned += 1;
        const ext = path.extname(filename).toLowerCase();
        const inputPath = path.join(productsDir, filename);

        try {
            const optimizedBuffer = await optimizeImageBuffer(inputPath, ext);
            const originalSize = await getFileSize(inputPath);
            const optimizedSize = optimizedBuffer.length;
            const shouldKeepOptimized = optimizedSize < originalSize * 0.98;

            if (!shouldKeepOptimized) {
                skipped += 1;
                continue;
            }

            if (applyChanges) {
                await fs.promises.writeFile(inputPath, optimizedBuffer);
            }

            optimized += 1;
            totalSavedBytes += Math.max(0, originalSize - optimizedSize);
        } catch (error) {
            errors += 1;
            console.warn(`Failed: ${filename} -> ${error.message}`);
        }
    }

    let updatedProducts = 0;
    if (applyChanges && rewriteDbToWebp) {
        if (!hasPostgresConfig()) {
            console.warn('Skipping DB URL rewrite: PostgreSQL env is not configured.');
        } else {
            const { dbAll, dbRun } = await import('../database/db.js');
            const rows = await dbAll('SELECT id, images FROM products');
            const urlMap = new Map();

            for (const row of rows) {
                const images = toArray(row.images);
                images
                    .filter(isLocalProductImage)
                    .forEach((url) => {
                        const ext = path.extname(url).toLowerCase();
                        if (!supportedExtensions.has(ext)) return;
                        const webpUrl = `/images/products/${path.basename(url, ext)}.webp`;
                        const webpPath = path.join(productsDir, path.basename(webpUrl));
                        if (fs.existsSync(webpPath)) {
                            urlMap.set(url, webpUrl);
                        }
                    });
            }

            if (urlMap.size > 0) {
                for (const row of rows) {
                    const images = toArray(row.images);
                    if (!images.length) continue;

                    const nextImages = images.map((url) => urlMap.get(url) || url);
                    const changed = nextImages.some((url, idx) => url !== images[idx]);
                    if (!changed) continue;

                    await dbRun(
                        'UPDATE products SET images = ?::jsonb, updated_at = NOW() WHERE id = ?',
                        [JSON.stringify(nextImages), row.id]
                    );
                    updatedProducts += 1;
                }
            }
        }
    }

    console.log('--- Summary ---');
    console.log(`Files scanned: ${scanned}`);
    console.log(`Optimized: ${optimized}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Saved: ${(totalSavedBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Products updated in DB: ${updatedProducts}`);

    if (!applyChanges) {
        console.log('Dry run complete. Re-run with --apply to write optimized files.');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
