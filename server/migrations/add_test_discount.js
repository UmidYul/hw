import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new sqlite3.Database(join(__dirname, '..', 'database', 'ecommerce.db'));

const sql = `INSERT INTO discounts (
  name, description, discount_type, discount_value, target, is_active, priority
) VALUES (?, ?, ?, ?, ?, ?, ?)`;

db.run(sql, [
    'Распродажа',
    'Скидка 20% на все товары',
    'percent',
    20,
    'all',
    1,
    0
], function (err) {
    if (err) {
        console.error('Ошибка создания скидки:', err.message);
    } else {
        console.log('✅ Тестовая скидка создана с ID:', this.lastID);
    }

    db.close();
});
