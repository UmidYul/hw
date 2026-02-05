import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new sqlite3.Database(join(__dirname, '..', 'database', 'aura.db'));

db.serialize(() => {
    // Drop existing table
    db.run('DROP TABLE IF EXISTS discounts', (err) => {
        if (err) {
            console.error('Error dropping table:', err.message);
        } else {
            console.log('✅ Dropped old discounts table');
        }
    });

    // Create new table with description column
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS discounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            discount_type TEXT NOT NULL CHECK(discount_type IN ('percent', 'fixed')),
            discount_value REAL NOT NULL,
            target TEXT NOT NULL CHECK(target IN ('all', 'category', 'collection', 'products')),
            category_id INTEGER,
            collection_id INTEGER,
            product_ids TEXT,
            min_amount REAL DEFAULT 0,
            priority INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            combine_with_other BOOLEAN DEFAULT 0,
            start_date DATETIME,
            end_date DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id),
            FOREIGN KEY (collection_id) REFERENCES collections(id)
        )
    `;

    db.run(createTableSQL, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('✅ Created new discounts table with description column');
        }
    });

    // Create indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(is_active, start_date, end_date)', (err) => {
        if (err) console.error('Error creating index:', err.message);
        else console.log('✅ Created index on active discounts');
    });

    db.run('CREATE INDEX IF NOT EXISTS idx_discounts_category ON discounts(category_id)', (err) => {
        if (err) console.error('Error creating index:', err.message);
        else console.log('✅ Created index on category_id');
    });

    db.run('CREATE INDEX IF NOT EXISTS idx_discounts_collection ON discounts(collection_id)', (err) => {
        if (err) console.error('Error creating index:', err.message);
        else console.log('✅ Created index on collection_id');
    });
});

db.close(() => {
    console.log('✅ Migration completed');
});
