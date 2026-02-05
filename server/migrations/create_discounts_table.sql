-- Create discounts table with updated structure
CREATE TABLE IF NOT EXISTS discounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL CHECK(discount_type IN ('percent', 'fixed')),
    discount_value REAL NOT NULL,
    target TEXT NOT NULL CHECK(target IN ('all', 'category', 'collection', 'products')),
    category_id INTEGER,
    collection_id INTEGER,
    product_ids TEXT, -- JSON array
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
);

-- Create index for active discounts query
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_discounts_category ON discounts(category_id);
CREATE INDEX IF NOT EXISTS idx_discounts_collection ON discounts(collection_id);
