-- Products
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL,
    old_price NUMERIC,
    tags JSONB DEFAULT '[]'::jsonb,
    colors JSONB DEFAULT '[]'::jsonb,
    sizes JSONB DEFAULT '[]'::jsonb,
    rating NUMERIC DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,
    images JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    material TEXT,
    care TEXT,
    fit TEXT,
    delivery_info TEXT,
    stock INTEGER DEFAULT 0,
    sku TEXT UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Product Variants (color/size stock)
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, color, size)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image TEXT,
    parent_id INTEGER REFERENCES categories(id),
    order_index INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Collections
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    type TEXT DEFAULT 'manual',
    conditions JSONB,
    product_ids JSONB DEFAULT '[]'::jsonb,
    is_visible BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Banners
CREATE TABLE IF NOT EXISTS banners (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    button_text TEXT,
    button_link TEXT,
    image TEXT,
    background_color TEXT DEFAULT '#F5F5F5',
    text_color TEXT DEFAULT '#2D2D2D',
    placement TEXT DEFAULT 'hero',
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT UNIQUE NOT NULL,
    total_orders INTEGER DEFAULT 0,
    total_spent NUMERIC DEFAULT 0,
    last_order_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES customers(id),
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    shipping_address TEXT,
    items JSONB NOT NULL,
    subtotal NUMERIC NOT NULL,
    discount NUMERIC DEFAULT 0,
    shipping NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending',
    notes TEXT,
    promo_code TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Promocodes
CREATE TABLE IF NOT EXISTS promocodes (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    min_amount NUMERIC DEFAULT 0,
    exclude_sale BOOLEAN DEFAULT FALSE,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    max_uses_per_user INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Promocode usage
CREATE TABLE IF NOT EXISTS promocode_usage (
    id SERIAL PRIMARY KEY,
    promocode_id INTEGER NOT NULL REFERENCES promocodes(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    customer_phone TEXT,
    used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Discounts
CREATE TABLE IF NOT EXISTS discounts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL,
    discount_value NUMERIC NOT NULL,
    target TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    collection_id INTEGER REFERENCES collections(id),
    product_ids JSONB,
    min_amount NUMERIC DEFAULT 0,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    combine_with_other BOOLEAN DEFAULT FALSE,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Content Settings (for homepage)
CREATE TABLE IF NOT EXISTS content_settings (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    site_name TEXT DEFAULT 'AURA',
    logo_text TEXT DEFAULT 'AURA',
    store_description TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    social_instagram TEXT,
    social_facebook TEXT,
    social_telegram TEXT,
    color_palette JSONB,
    sizes_list JSONB,
    currency TEXT DEFAULT 'UZS',
    currency_symbol TEXT DEFAULT 'Сумм',
    vat_rate NUMERIC DEFAULT 0,
    shipping_cost NUMERIC DEFAULT 0,
    free_shipping_threshold NUMERIC DEFAULT 0,
    enable_taxes BOOLEAN DEFAULT FALSE,
    return_policy TEXT,
    privacy_policy TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    images JSONB,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(is_approved);
