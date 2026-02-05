import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyPromoTrackingMigration() {
    console.log('🔄 Applying promo tracking migration...');

    try {
        // Read migration file
        const migrationPath = path.join(__dirname, 'add_promo_tracking.sql');
        const migration = fs.readFileSync(migrationPath, 'utf8');

        // Split by semicolon and execute each statement
        const statements = migration
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            try {
                await new Promise((resolve, reject) => {
                    db.run(statement, (err) => {
                        if (err) {
                            // Ignore errors for ALTER TABLE if column already exists
                            if (err.message.includes('duplicate column name')) {
                                console.log('ℹ️ Column already exists, skipping');
                                resolve();
                            } else {
                                reject(err);
                            }
                        } else {
                            resolve();
                        }
                    });
                });
            } catch (err) {
                console.error('⚠️ Statement error:', err.message);
            }
        }

        console.log('✅ Promo tracking migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

applyPromoTrackingMigration();
