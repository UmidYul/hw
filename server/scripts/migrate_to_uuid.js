import crypto from 'crypto';
import pool from '../database/db.js';

const generateId = () => crypto.randomUUID();

const withClient = async (fn) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await fn(client);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const addColumnIfMissing = async (client, table, column, type) => {
    await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
};

const columnExists = async (client, table, column) => {
    const result = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [table, column]
    );
    return result.rows.length > 0;
};

const dropConstraint = async (client, table, constraint) => {
    await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint} CASCADE`);
};

const renameColumn = async (client, table, from, to) => {
    const hasFrom = await columnExists(client, table, from);
    if (!hasFrom) return;
    const hasTo = await columnExists(client, table, to);
    if (hasTo) return;
    await client.query(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
};

const addPrimaryKey = async (client, table, column = 'id') => {
    await client.query(`ALTER TABLE ${table} ADD PRIMARY KEY (${column})`);
};

const addForeignKey = async (client, table, column, refTable, refColumn = 'id', onDelete = 'NO ACTION') => {
    await client.query(
        `ALTER TABLE ${table} ADD CONSTRAINT ${table}_${column}_fkey FOREIGN KEY (${column}) REFERENCES ${refTable}(${refColumn}) ON DELETE ${onDelete}`
    );
};

const buildIdMap = async (client, table) => {
    await addColumnIfMissing(client, table, 'id_uuid', 'UUID');
    const { rows } = await client.query(`SELECT id FROM ${table}`);
    const map = new Map();

    for (const row of rows) {
        const newId = generateId();
        map.set(String(row.id), newId);
        await client.query(`UPDATE ${table} SET id_uuid = $1 WHERE id = $2`, [newId, row.id]);
    }

    return map;
};

const updateJsonArray = (list, map) => {
    if (!Array.isArray(list)) return [];
    return list.map((value) => map.get(String(value)) || value).filter(Boolean);
};

const migrate = async () => {
    await withClient(async (client) => {
        const productMap = await buildIdMap(client, 'products');
        const variantMap = await buildIdMap(client, 'product_variants');
        const categoryMap = await buildIdMap(client, 'categories');
        const collectionMap = await buildIdMap(client, 'collections');
        const bannerMap = await buildIdMap(client, 'banners');
        const customerMap = await buildIdMap(client, 'customers');
        const orderMap = await buildIdMap(client, 'orders');
        const promoMap = await buildIdMap(client, 'promocodes');
        const discountMap = await buildIdMap(client, 'discounts');
        const contentMap = await buildIdMap(client, 'content_settings');
        const subscriberMap = await buildIdMap(client, 'subscribers');
        const reviewMap = await buildIdMap(client, 'reviews');
        const settingsMap = await buildIdMap(client, 'settings');
        const adminUserMap = await buildIdMap(client, 'admin_users');
        const refreshTokenMap = await buildIdMap(client, 'refresh_tokens');

        await addColumnIfMissing(client, 'product_variants', 'product_id_uuid', 'UUID');
        await addColumnIfMissing(client, 'categories', 'parent_id_uuid', 'UUID');
        await addColumnIfMissing(client, 'orders', 'customer_id_uuid', 'UUID');
        await addColumnIfMissing(client, 'promocode_usage', 'promocode_id_uuid', 'UUID');
        await addColumnIfMissing(client, 'promocode_usage', 'order_id_uuid', 'UUID');
        await addColumnIfMissing(client, 'discounts', 'category_id_uuid', 'UUID');
        await addColumnIfMissing(client, 'discounts', 'collection_id_uuid', 'UUID');
        await addColumnIfMissing(client, 'reviews', 'product_id_uuid', 'UUID');
        await addColumnIfMissing(client, 'refresh_tokens', 'user_id_uuid', 'UUID');

        for (const [oldId, newId] of productMap.entries()) {
            await client.query('UPDATE product_variants SET product_id_uuid = $1 WHERE product_id = $2', [newId, oldId]);
            await client.query('UPDATE reviews SET product_id_uuid = $1 WHERE product_id = $2', [newId, oldId]);
        }

        for (const [oldId, newId] of categoryMap.entries()) {
            await client.query('UPDATE categories SET parent_id_uuid = $1 WHERE parent_id = $2', [newId, oldId]);
            await client.query('UPDATE discounts SET category_id_uuid = $1 WHERE category_id = $2', [newId, oldId]);
        }

        for (const [oldId, newId] of collectionMap.entries()) {
            await client.query('UPDATE discounts SET collection_id_uuid = $1 WHERE collection_id = $2', [newId, oldId]);
        }

        for (const [oldId, newId] of customerMap.entries()) {
            await client.query('UPDATE orders SET customer_id_uuid = $1 WHERE customer_id = $2', [newId, oldId]);
        }

        for (const [oldId, newId] of promoMap.entries()) {
            await client.query('UPDATE promocode_usage SET promocode_id_uuid = $1 WHERE promocode_id = $2', [newId, oldId]);
        }

        for (const [oldId, newId] of orderMap.entries()) {
            await client.query('UPDATE promocode_usage SET order_id_uuid = $1 WHERE order_id = $2', [newId, oldId]);
        }

        for (const [oldId, newId] of adminUserMap.entries()) {
            await client.query('UPDATE refresh_tokens SET user_id_uuid = $1 WHERE user_id = $2', [newId, oldId]);
        }

        const collections = await client.query('SELECT id, product_ids FROM collections');
        for (const row of collections.rows) {
            const list = typeof row.product_ids === 'string' ? JSON.parse(row.product_ids) : row.product_ids;
            const updated = updateJsonArray(list, productMap);
            await client.query('UPDATE collections SET product_ids = $1 WHERE id = $2', [JSON.stringify(updated), row.id]);
        }

        const discounts = await client.query('SELECT id, product_ids FROM discounts');
        for (const row of discounts.rows) {
            if (!row.product_ids) continue;
            const list = typeof row.product_ids === 'string' ? JSON.parse(row.product_ids) : row.product_ids;
            const updated = updateJsonArray(list, productMap);
            await client.query('UPDATE discounts SET product_ids = $1 WHERE id = $2', [JSON.stringify(updated), row.id]);
        }

        const contentSettings = await client.query("SELECT id, key, value FROM content_settings WHERE key = 'featuredCollections'");
        for (const row of contentSettings.rows) {
            const list = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            const updated = updateJsonArray(list, collectionMap);
            await client.query('UPDATE content_settings SET value = $1 WHERE id = $2', [JSON.stringify(updated), row.id]);
        }

        const orders = await client.query('SELECT id, items FROM orders');
        for (const row of orders.rows) {
            const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
            const updatedItems = Array.isArray(items)
                ? items.map((item) => {
                    const next = { ...item };
                    if (next.productId !== undefined) {
                        next.productId = productMap.get(String(next.productId)) || next.productId;
                    }
                    if (next.id !== undefined) {
                        next.id = productMap.get(String(next.id)) || next.id;
                    }
                    if (next.variantId !== undefined && next.variantId !== null) {
                        next.variantId = variantMap.get(String(next.variantId)) || next.variantId;
                    }
                    if (next.variant_id !== undefined && next.variant_id !== null) {
                        next.variant_id = variantMap.get(String(next.variant_id)) || next.variant_id;
                    }
                    return next;
                })
                : [];
            await client.query('UPDATE orders SET items = $1 WHERE id = $2', [JSON.stringify(updatedItems), row.id]);
        }

        await dropConstraint(client, 'product_variants', 'product_variants_pkey');
        await dropConstraint(client, 'categories', 'categories_pkey');
        await dropConstraint(client, 'collections', 'collections_pkey');
        await dropConstraint(client, 'banners', 'banners_pkey');
        await dropConstraint(client, 'customers', 'customers_pkey');
        await dropConstraint(client, 'orders', 'orders_pkey');
        await dropConstraint(client, 'promocodes', 'promocodes_pkey');
        await dropConstraint(client, 'promocode_usage', 'promocode_usage_pkey');
        await dropConstraint(client, 'discounts', 'discounts_pkey');
        await dropConstraint(client, 'content_settings', 'content_settings_pkey');
        await dropConstraint(client, 'subscribers', 'subscribers_pkey');
        await dropConstraint(client, 'settings', 'settings_pkey');
        await dropConstraint(client, 'settings', 'settings_id_check');
        await dropConstraint(client, 'reviews', 'reviews_pkey');
        await dropConstraint(client, 'products', 'products_pkey');
        await dropConstraint(client, 'admin_users', 'admin_users_pkey');
        await dropConstraint(client, 'refresh_tokens', 'refresh_tokens_pkey');

        await dropConstraint(client, 'product_variants', 'product_variants_product_id_fkey');
        await dropConstraint(client, 'categories', 'categories_parent_id_fkey');
        await dropConstraint(client, 'orders', 'orders_customer_id_fkey');
        await dropConstraint(client, 'promocode_usage', 'promocode_usage_promocode_id_fkey');
        await dropConstraint(client, 'promocode_usage', 'promocode_usage_order_id_fkey');
        await dropConstraint(client, 'discounts', 'discounts_category_id_fkey');
        await dropConstraint(client, 'discounts', 'discounts_collection_id_fkey');
        await dropConstraint(client, 'reviews', 'reviews_product_id_fkey');
        await dropConstraint(client, 'refresh_tokens', 'refresh_tokens_user_id_fkey');
        await dropConstraint(client, 'product_variants', 'product_variants_product_id_color_size_key');

        await renameColumn(client, 'products', 'id', 'legacy_id');
        await renameColumn(client, 'products', 'id_uuid', 'id');

        await renameColumn(client, 'product_variants', 'id', 'legacy_id');
        await renameColumn(client, 'product_variants', 'id_uuid', 'id');
        await renameColumn(client, 'product_variants', 'product_id', 'legacy_product_id');
        await renameColumn(client, 'product_variants', 'product_id_uuid', 'product_id');

        await renameColumn(client, 'categories', 'id', 'legacy_id');
        await renameColumn(client, 'categories', 'id_uuid', 'id');
        await renameColumn(client, 'categories', 'parent_id', 'legacy_parent_id');
        await renameColumn(client, 'categories', 'parent_id_uuid', 'parent_id');

        await renameColumn(client, 'collections', 'id', 'legacy_id');
        await renameColumn(client, 'collections', 'id_uuid', 'id');

        await renameColumn(client, 'banners', 'id', 'legacy_id');
        await renameColumn(client, 'banners', 'id_uuid', 'id');

        await renameColumn(client, 'customers', 'id', 'legacy_id');
        await renameColumn(client, 'customers', 'id_uuid', 'id');

        await renameColumn(client, 'orders', 'id', 'legacy_id');
        await renameColumn(client, 'orders', 'id_uuid', 'id');
        await renameColumn(client, 'orders', 'customer_id', 'legacy_customer_id');
        await renameColumn(client, 'orders', 'customer_id_uuid', 'customer_id');

        await renameColumn(client, 'promocodes', 'id', 'legacy_id');
        await renameColumn(client, 'promocodes', 'id_uuid', 'id');

        await renameColumn(client, 'promocode_usage', 'id', 'legacy_id');
        await renameColumn(client, 'promocode_usage', 'id_uuid', 'id');
        await renameColumn(client, 'promocode_usage', 'promocode_id', 'legacy_promocode_id');
        await renameColumn(client, 'promocode_usage', 'promocode_id_uuid', 'promocode_id');
        await renameColumn(client, 'promocode_usage', 'order_id', 'legacy_order_id');
        await renameColumn(client, 'promocode_usage', 'order_id_uuid', 'order_id');

        await renameColumn(client, 'discounts', 'id', 'legacy_id');
        await renameColumn(client, 'discounts', 'id_uuid', 'id');
        await renameColumn(client, 'discounts', 'category_id', 'legacy_category_id');
        await renameColumn(client, 'discounts', 'category_id_uuid', 'category_id');
        await renameColumn(client, 'discounts', 'collection_id', 'legacy_collection_id');
        await renameColumn(client, 'discounts', 'collection_id_uuid', 'collection_id');

        await renameColumn(client, 'content_settings', 'id', 'legacy_id');
        await renameColumn(client, 'content_settings', 'id_uuid', 'id');

        await renameColumn(client, 'subscribers', 'id', 'legacy_id');
        await renameColumn(client, 'subscribers', 'id_uuid', 'id');

        await renameColumn(client, 'settings', 'id', 'legacy_id');
        await renameColumn(client, 'settings', 'id_uuid', 'id');

        await renameColumn(client, 'reviews', 'id', 'legacy_id');
        await renameColumn(client, 'reviews', 'id_uuid', 'id');
        await renameColumn(client, 'reviews', 'product_id', 'legacy_product_id');
        await renameColumn(client, 'reviews', 'product_id_uuid', 'product_id');

        await renameColumn(client, 'admin_users', 'id', 'legacy_id');
        await renameColumn(client, 'admin_users', 'id_uuid', 'id');

        await renameColumn(client, 'refresh_tokens', 'id', 'legacy_id');
        await renameColumn(client, 'refresh_tokens', 'id_uuid', 'id');
        await renameColumn(client, 'refresh_tokens', 'user_id', 'legacy_user_id');
        await renameColumn(client, 'refresh_tokens', 'user_id_uuid', 'user_id');

        await addPrimaryKey(client, 'products');
        await addPrimaryKey(client, 'product_variants');
        await addPrimaryKey(client, 'categories');
        await addPrimaryKey(client, 'collections');
        await addPrimaryKey(client, 'banners');
        await addPrimaryKey(client, 'customers');
        await addPrimaryKey(client, 'orders');
        await addPrimaryKey(client, 'promocodes');
        await addPrimaryKey(client, 'promocode_usage');
        await addPrimaryKey(client, 'discounts');
        await addPrimaryKey(client, 'content_settings');
        await addPrimaryKey(client, 'subscribers');
        await addPrimaryKey(client, 'settings');
        await addPrimaryKey(client, 'reviews');
        await addPrimaryKey(client, 'admin_users');
        await addPrimaryKey(client, 'refresh_tokens');

        await addForeignKey(client, 'product_variants', 'product_id', 'products', 'id', 'CASCADE');
        await addForeignKey(client, 'categories', 'parent_id', 'categories', 'id', 'SET NULL');
        await addForeignKey(client, 'orders', 'customer_id', 'customers', 'id', 'SET NULL');
        await addForeignKey(client, 'promocode_usage', 'promocode_id', 'promocodes', 'id', 'CASCADE');
        await addForeignKey(client, 'promocode_usage', 'order_id', 'orders', 'id', 'SET NULL');
        await addForeignKey(client, 'discounts', 'category_id', 'categories', 'id', 'SET NULL');
        await addForeignKey(client, 'discounts', 'collection_id', 'collections', 'id', 'SET NULL');
        await addForeignKey(client, 'reviews', 'product_id', 'products', 'id', 'CASCADE');
        await addForeignKey(client, 'refresh_tokens', 'user_id', 'admin_users', 'id', 'CASCADE');

        await client.query('ALTER TABLE product_variants ADD CONSTRAINT product_variants_product_color_size_unique UNIQUE (product_id, color, size)');
    });
};

migrate()
    .then(() => {
        console.log('UUID migration completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('UUID migration failed:', error);
        process.exit(1);
    });
