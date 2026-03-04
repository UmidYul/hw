/**
 * Bulk-compress all uploaded images (products / banners / newsletters / logo) → WebP.
 * Usage:
 *   node scripts/optimize_all_images.js            # dry-run (shows what would change)
 *   node scripts/optimize_all_images.js --apply    # write files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

const args = process.argv.slice(2);
const apply = args.includes('--apply');

const DIRS = [
    { dir: path.join(projectRoot, 'public/images/products'), quality: 82, maxSide: 1600 },
    { dir: path.join(projectRoot, 'public/images/banners'), quality: 85, maxSide: 1920 },
    { dir: path.join(projectRoot, 'public/images/newsletters'), quality: 82, maxSide: 1400 },
    { dir: path.join(projectRoot, 'public/images/logo'), quality: 88, maxSide: 400 },
];

const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.webp']);

let totalScanned = 0;
let totalConverted = 0;
let totalSkipped = 0;
let totalErrors = 0;
let totalSavedBytes = 0;

async function processDir({ dir, quality, maxSide }) {
    if (!fs.existsSync(dir)) {
        console.log(`  [skip] directory not found: ${dir}`);
        return;
    }

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = entries
        .filter(e => e.isFile() && SUPPORTED.has(path.extname(e.name).toLowerCase()))
        .map(e => e.name);

    for (const filename of files) {
        totalScanned++;
        const inputPath = path.join(dir, filename);
        const ext = path.extname(filename).toLowerCase();
        const baseName = filename.slice(0, filename.length - ext.length);
        const webpPath = path.join(dir, baseName + '.webp');

        try {
            const originalSize = (await fs.promises.stat(inputPath)).size;

            const buffer = await sharp(inputPath)
                .rotate()
                .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
                .webp({ quality, effort: 4, smartSubsample: true })
                .toBuffer();

            const newSize = buffer.length;
            const saved = originalSize - newSize;

            if (apply) {
                await fs.promises.writeFile(webpPath, buffer);
                // Remove original only if it's a different file (not already .webp)
                if (ext !== '.webp') {
                    await fs.promises.unlink(inputPath).catch(() => { });
                }
                console.log(`  ✓ ${filename} → ${baseName}.webp  ${(originalSize / 1024).toFixed(0)} KB → ${(newSize / 1024).toFixed(0)} KB  (${saved > 0 ? '-' + (saved / 1024).toFixed(0) + ' KB' : 'no savings'})`);
            } else {
                console.log(`  ~ ${filename} → ${baseName}.webp  ${(originalSize / 1024).toFixed(0)} KB → ${(newSize / 1024).toFixed(0)} KB  (dry-run)`);
            }

            totalConverted++;
            totalSavedBytes += Math.max(0, saved);
        } catch (err) {
            totalErrors++;
            console.warn(`  ✗ ${filename}: ${err.message}`);
        }
    }
}

async function main() {
    console.log(`Mode: ${apply ? 'APPLY' : 'dry-run (add --apply to write files)'}\n`);

    for (const entry of DIRS) {
        console.log(`Directory: ${path.relative(projectRoot, entry.dir)}`);
        await processDir(entry);
        console.log('');
    }

    console.log('───────────── Summary ─────────────');
    console.log(`Scanned:   ${totalScanned}`);
    console.log(`Converted: ${totalConverted}`);
    console.log(`Skipped:   ${totalSkipped}`);
    console.log(`Errors:    ${totalErrors}`);
    console.log(`Saved:     ${(totalSavedBytes / 1024 / 1024).toFixed(2)} MB`);
    if (!apply) {
        console.log('\nRun with --apply to actually write the files.');
    }
}

main().catch(err => { console.error(err.message); process.exit(1); });
