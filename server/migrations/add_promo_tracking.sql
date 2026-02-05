-- Add max_uses_per_user to promocodes table
ALTER TABLE promocodes ADD COLUMN max_uses_per_user INTEGER DEFAULT NULL;

-- Create promo_usage table for tracking individual uses
CREATE TABLE IF NOT EXISTS promo_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    promo_code TEXT NOT NULL,
    customer_identifier TEXT NOT NULL, -- email or phone
    order_id INTEGER,
    discount_amount REAL NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_promo_usage_code ON promo_usage(promo_code);
CREATE INDEX IF NOT EXISTS idx_promo_usage_customer ON promo_usage(customer_identifier);
CREATE INDEX IF NOT EXISTS idx_promo_usage_code_customer ON promo_usage(promo_code, customer_identifier);
