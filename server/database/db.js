import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const hasPgConfig = !!(process.env.DATABASE_URL || process.env.PGHOST || process.env.PGDATABASE);
if (!hasPgConfig) {
    console.warn('⚠️ PostgreSQL env is missing. Check .env for PGHOST/PGDATABASE/PGUSER/PGPASSWORD.');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.PGHOST,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
});

pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

(async () => {
    try {
        await pool.query('SELECT 1');
        console.log('✅ PostgreSQL connection check passed');
    } catch (error) {
        console.error('❌ PostgreSQL connection check failed:', error.message);
    }
})();

const normalizeSql = (sql) => {
    let index = 0;
    let inSingleQuote = false;
    let output = '';

    for (let i = 0; i < sql.length; i += 1) {
        const char = sql[i];
        if (char === "'") {
            inSingleQuote = !inSingleQuote;
            output += char;
            continue;
        }

        if (char === '?' && !inSingleQuote) {
            index += 1;
            output += `$${index}`;
            continue;
        }

        output += char;
    }

    return output;
};

export const dbRun = async (sql, params = []) => {
    const normalized = normalizeSql(sql);
    const result = await pool.query(normalized, params);
    return {
        id: result.rows?.[0]?.id,
        changes: result.rowCount
    };
};

export const dbGet = async (sql, params = []) => {
    const normalized = normalizeSql(sql);
    const result = await pool.query(normalized, params);
    return result.rows?.[0];
};

export const dbAll = async (sql, params = []) => {
    const normalized = normalizeSql(sql);
    const result = await pool.query(normalized, params);
    return result.rows;
};

export default pool;
