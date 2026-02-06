# AURA E-commerce Server

Backend API для интернет-магазина AURA на Express.js + PostgreSQL.

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd server
npm install
```

### 2. Создание и настройка базы данных

```bash
npm run migrate
```

Эта команда:
- Создаст таблицы в PostgreSQL
- Импортирует товары из `public/js/data.js` (если база пустая)

### 3. Запуск сервера

**Режим разработки (с автоперезагрузкой):**
```bash
npm run dev
```

**Продакшн режим:**
```bash
npm start
```

Сервер запустится на `http://localhost:3000`

## 📁 Структура проекта

```
server/
├── database/
│   ├── db.js           # Подключение к БД
│   └── schema.sql      # SQL схема
├── migrations/
│   └── migrate.js      # Скрипт миграций
├── routes/
│   ├── products.js     # API товаров
│   ├── orders.js       # API заказов
│   ├── customers.js    # API клиентов
│   ├── banners.js      # API баннеров
│   ├── collections.js  # API коллекций
│   ├── categories.js   # API категорий
│   ├── promocodes.js   # API промокодов
│   ├── discounts.js    # API скидок
│   └── content.js      # API настроек контента
├── .env                # Переменные окружения
├── package.json
└── server.js           # Главный файл сервера
```

## 🔌 API Endpoints

### Products (Товары)
- `GET /api/products` - Получить все товары
  - Query params: `category`, `tag`, `search`, `limit`, `offset`
- `GET /api/products/:id` - Получить товар по ID
- `POST /api/products` - Создать товар
- `PUT /api/products/:id` - Обновить товар
- `DELETE /api/products/:id` - Удалить товар

### Orders (Заказы)
- `GET /api/orders` - Получить все заказы
  - Query params: `status`, `limit`, `offset`
- `GET /api/orders/:id` - Получить заказ по ID
- `POST /api/orders` - Создать заказ
- `PATCH /api/orders/:id/status` - Обновить статус заказа
- `DELETE /api/orders/:id` - Удалить заказ

### Customers (Клиенты)
- `GET /api/customers` - Получить всех клиентов
- `GET /api/customers/:id` - Получить клиента по ID (с заказами)
- `PUT /api/customers/:id` - Обновить клиента
- `DELETE /api/customers/:id` - Удалить клиента

### Banners (Баннеры)
- `GET /api/banners` - Получить все баннеры
  - Query params: `placement`, `active`
- `GET /api/banners/active` - Получить активные баннеры
- `GET /api/banners/:id` - Получить баннер по ID
- `POST /api/banners` - Создать баннер
- `PUT /api/banners/:id` - Обновить баннер
- `DELETE /api/banners/:id` - Удалить баннер

### Collections (Коллекции)
- `GET /api/collections` - Получить все коллекции
  - Query params: `visible`
- `GET /api/collections/slug/:slug` - Получить коллекцию по slug (с товарами)
- `GET /api/collections/:id` - Получить коллекцию по ID
- `POST /api/collections` - Создать коллекцию
- `PUT /api/collections/:id` - Обновить коллекцию
- `DELETE /api/collections/:id` - Удалить коллекцию

### Categories (Категории)
- `GET /api/categories` - Получить все категории
- `GET /api/categories/visible` - Получить видимые категории
- `POST /api/categories` - Создать категорию
- `PUT /api/categories/:id` - Обновить категорию
- `DELETE /api/categories/:id` - Удалить категорию

### Promocodes (Промокоды)
- `GET /api/promocodes` - Получить все промокоды
- `POST /api/promocodes/validate` - Валидировать промокод
  - Body: `{ code, amount }`
- `POST /api/promocodes` - Создать промокод
- `PUT /api/promocodes/:id` - Обновить промокод
- `DELETE /api/promocodes/:id` - Удалить промокод

### Discounts (Скидки)
- `GET /api/discounts` - Получить все скидки
- `GET /api/discounts/active` - Получить активные скидки
- `POST /api/discounts` - Создать скидку
- `PUT /api/discounts/:id` - Обновить скидку
- `DELETE /api/discounts/:id` - Удалить скидку

### Content (Контент главной страницы)
- `GET /api/content` - Получить все настройки
- `GET /api/content/:key` - Получить настройку по ключу
- `PUT /api/content/:key` - Обновить настройку
  - Body: `{ value: {...} }`

### Health Check
- `GET /api/health` - Проверка работоспособности API

## 🗄️ База данных

### Таблицы:
- `products` - Товары
- `categories` - Категории
- `collections` - Коллекции
- `banners` - Баннеры
- `orders` - Заказы
- `customers` - Клиенты
- `promocodes` - Промокоды
- `discounts` - Скидки
- `content_settings` - Настройки контента
- `reviews` - Отзывы (готово для будущего использования)

### PostgreSQL
- Рекомендуемая БД для продакшена и разработки
- Хранит данные в отдельном сервере
- Полная поддержка JSONB и сложных запросов

## 🔄 Миграции

Используйте `npm run migrate` для создания таблиц в PostgreSQL.

## 🛠️ Разработка

### Переменные окружения (.env)

```env
PORT=3000
NODE_ENV=development
PGHOST=localhost
PGPORT=5432
PGDATABASE=aura
PGUSER=postgres
PGPASSWORD=changeme
PGSSL=false
```

### Полезные команды

```bash
# Установка зависимостей
npm install

# Запуск с автоперезагрузкой
npm run dev

# Запуск продакшн
npm start

# Создать таблицы
npm run migrate
```

## 📦 Зависимости

- `express` - Web framework
- `cors` - Cross-Origin Resource Sharing
- `pg` - PostgreSQL driver
- `dotenv` - Environment variables
- `body-parser` - Parse request bodies
- `nodemon` - Auto-restart (dev)

## 🔐 Безопасность

**Текущая версия:**
- ⚠️ Нет аутентификации
- ⚠️ Нет авторизации
- ⚠️ Админка доступна всем

**Для продакшена добавить:**
- JWT токены для админки
- Валидация всех входных данных
- Rate limiting
- HTTPS
- Sanitization
- CSRF защита

## 🚀 Деплой

### Heroku (пример)

```bash
# Установить Heroku CLI
# Логин
heroku login

# Создать приложение
heroku create aura-ecommerce

# Деплой
git push heroku main

# Запустить миграции
heroku run npm run migrate
```

### VPS (Ubuntu)

```bash
# Установить Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Клонировать репозиторий
git clone <repo>
cd hw/server

# Установить зависимости
npm install

# Запустить миграции
npm run migrate

# Установить PM2
npm install -g pm2

# Запустить
pm2 start server.js --name aura-api

# Автозапуск
pm2 startup
pm2 save
```

## 📝 TODO

- [ ] Добавить аутентификацию (JWT)
- [ ] Валидация входных данных
- [ ] Pagination для больших списков
- [ ] Фильтры и сортировка
- [ ] Загрузка изображений
- [ ] Полнотекстовый поиск
- [ ] Кэширование (Redis)
- [ ] Логирование (Winston)
- [ ] Тесты (Jest)
- [ ] API документация (Swagger)

## 💡 Примеры использования

### Создание товара

```javascript
fetch('http://localhost:3000/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Новый товар',
    category: 'Tops',
    price: 5990,
    colors: ['Black', 'White'],
    sizes: ['S', 'M', 'L'],
    images: ['image1.jpg'],
    description: 'Описание товара'
  })
})
```

### Получение активных баннеров

```javascript
fetch('http://localhost:3000/api/banners/active')
  .then(res => res.json())
  .then(banners => console.log(banners))
```

### Создание заказа

```javascript
fetch('http://localhost:3000/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerName: 'Иван Иванов',
    customerPhone: '+79001234567',
    customerEmail: 'ivan@example.com',
    items: [
      { productId: 1, quantity: 2, price: 5990 }
    ],
    subtotal: 11980,
    shipping: 500,
    total: 12480
  })
})
```

## 📞 Поддержка

При возникновении проблем проверьте:
1. Установлены ли все зависимости (`npm install`)
2. Запущены ли миграции (`npm run migrate`)
3. Доступен ли порт 3000
4. Существует ли файл БД (`server/database/aura.db`)

---

**Версия:** 1.0.0  
**Node.js:** >= 18.0.0  
**License:** ISC
