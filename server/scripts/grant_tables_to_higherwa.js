import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

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

const run = async () => {
    const targetOwner = 'higherwa';

    try {
        await pool.query('BEGIN');

        const tables = await pool.query(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        );
        for (const row of tables.rows) {
            const identifier = row.tablename.replace(/"/g, '');
            await pool.query(`ALTER TABLE public."${identifier}" OWNER TO ${targetOwner}`);
        }

        const sequences = await pool.query(
            "SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'"
        );
        for (const row of sequences.rows) {
            const identifier = row.sequencename.replace(/"/g, '');
            await pool.query(`ALTER SEQUENCE public."${identifier}" OWNER TO ${targetOwner}`);
        }

        const views = await pool.query(
            "SELECT viewname FROM pg_views WHERE schemaname = 'public'"
        );
        for (const row of views.rows) {
            const identifier = row.viewname.replace(/"/g, '');
            await pool.query(`ALTER VIEW public."${identifier}" OWNER TO ${targetOwner}`);
        }

        await pool.query('COMMIT');
        console.log(`✅ Ownership updated to ${targetOwner} for tables, sequences, and views.`);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('❌ Failed to update ownership:', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
};

run();
