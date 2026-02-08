import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.PGHOST,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
});
console.log({
    connectionString: process.env.DATABASE_URL,
    host: process.env.PGHOST,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
});


const run = async () => {
    const targetOwner = 'higherwa';
    const schema = 'public';
    const table = 'newsletters';

    try {
        await pool.query('BEGIN');

        await pool.query(`ALTER TABLE ${schema}."${table}" OWNER TO ${targetOwner}`);

        const seqResult = await pool.query(
            'SELECT pg_get_serial_sequence($1, $2) AS seq',
            [`${schema}.${table}`, 'id']
        );
        const seqName = seqResult.rows[0]?.seq;
        if (seqName) {
            await pool.query(`ALTER SEQUENCE ${seqName} OWNER TO ${targetOwner}`);
        }

        await pool.query('COMMIT');
        console.log(`✅ Ownership updated to ${targetOwner} for ${schema}.${table}.`);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('❌ Failed to update ownership:', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
};

run();
