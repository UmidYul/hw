import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
    console.log('🔄 Running database migrations...');

    try {
        // Read schema file
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Split by semicolon and execute each statement
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            await new Promise((resolve, reject) => {
                db.run(statement, (err) => {
                    if (err) {
                        console.error('❌ Migration error:', err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }

        console.log('✅ Migrations completed successfully');

        // Seed initial data if needed
        await seedInitialData();

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

async function seedInitialData() {
    console.log('🌱 Seeding initial data...');

    // Check if we already have data
    const productCount = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
        });
    });

    if (productCount > 0) {
        console.log('ℹ️ Data already exists, skipping seed');
        return;
    }

    // Import data from existing data.js
    console.log('📦 Importing products from data.js...');

    // Read and parse data.js
    const dataPath = path.join(__dirname, '../../public/js/data.js');
    if (fs.existsSync(dataPath)) {
        const dataContent = fs.readFileSync(dataPath, 'utf8');

        // Extract products array (simple regex, might need adjustment)
        const productsMatch = dataContent.match(/const products = (\[[\s\S]*?\]);/);
        if (productsMatch) {
            const productsJSON = productsMatch[1];
            const products = eval(productsJSON); // Safe here since it's our own file

            console.log(`📥 Importing ${products.length} products...`);

            for (const product of products) {
                const sql = `
          INSERT INTO products (
            id, title, category, price, old_price, tags, colors, sizes,
            rating, reviews_count, images, description, material, care, fit, delivery_info
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

                await new Promise((resolve, reject) => {
                    db.run(sql, [
                        product.id,
                        product.title,
                        product.category,
                        product.price,
                        product.oldPrice || null,
                        JSON.stringify(product.tags || []),
                        JSON.stringify(product.colors || []),
                        JSON.stringify(product.sizes || []),
                        product.rating || 0,
                        product.reviewsCount || 0,
                        JSON.stringify(product.images || []),
                        product.description || '',
                        product.material || '',
                        product.care || '',
                        product.fit || '',
                        product.deliveryInfo || ''
                    ], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            console.log('✅ Products imported successfully');
        }
    }

    console.log('✅ Initial data seeded');
}

runMigrations();
