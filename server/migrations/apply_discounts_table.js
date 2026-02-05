import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new sqlite3.Database(join(__dirname, '..', 'database', 'ecommerce.db'));

const migration = fs.readFileSync(join(__dirname, 'create_discounts_table.sql'), 'utf8');

db.serialize(() => {
    // Split by semicolons and run each statement
    const statements = migration.split(';').filter(s => s.trim());

    statements.forEach(statement => {
        db.run(statement, (err) => {
            if (err) {
                console.error('Migration error:', err.message);
            } else {
                console.log('✅ Executed:', statement.substring(0, 50) + '...');
            }
        });
    });
});

db.close(() => {
    console.log('✅ Discounts table migration completed');
});
