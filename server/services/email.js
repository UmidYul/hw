import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com'
};

let transporter = null;

const ensureTransporter = () => {
    if (transporter) return transporter;
    if (!smtpConfig.host) return null;

    const options = {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure
    };

    if (smtpConfig.user && smtpConfig.pass) {
        options.auth = {
            user: smtpConfig.user,
            pass: smtpConfig.pass
        };
    }

    transporter = nodemailer.createTransport(options);
    return transporter;
};

const formatPrice = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('ru-RU').format(amount) + ' Сумм';
};

const formatItemsTable = (items = []) => {
    if (!Array.isArray(items) || items.length === 0) return '';

    const rows = items.map((item) => {
        const title = item.title || item.name || 'Товар';
        const qty = item.quantity || 1;
        const price = formatPrice(item.price);
        const size = item.size ? `, ${item.size}` : '';
        const color = item.color ? `, ${item.color}` : '';
        return `
            <tr>
                <td style="padding: 6px 0;">${title}${size}${color}</td>
                <td style="padding: 6px 0; text-align: center;">${qty}</td>
                <td style="padding: 6px 0; text-align: right;">${price}</td>
            </tr>
        `;
    }).join('');

    return `
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
            <thead>
                <tr>
                    <th style="text-align: left; padding-bottom: 8px; border-bottom: 1px solid #eee;">Товар</th>
                    <th style="text-align: center; padding-bottom: 8px; border-bottom: 1px solid #eee;">Кол-во</th>
                    <th style="text-align: right; padding-bottom: 8px; border-bottom: 1px solid #eee;">Цена</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
};

const statusLabels = {
    pending: 'В обработке',
    processing: 'Собираем заказ',
    shipped: 'Отправлен',
    delivered: 'Доставлен',
    cancelled: 'Отменен',
    completed: 'Завершен'
};

const getStatusLabel = (status) => statusLabels[status] || status || 'Обновлен';

const getBaseUrl = () => {
    if (process.env.SERVER_URL) {
        return String(process.env.SERVER_URL).replace(/\/$/, '');
    }
    const port = process.env.PORT || 3000;
    return `http://localhost:${port}`;
};

const getSupportEmail = () => smtpConfig.user || 'support@example.com';

export const sendNewsletterWelcomeEmail = async ({ to, storeName = 'AURA', unsubscribeId = '' }) => {
    const mailer = ensureTransporter();
    if (!mailer) return false;

    const baseUrl = getBaseUrl();
    const encodedId = encodeURIComponent(String(unsubscribeId || '').trim());
    const unsubscribeUrl = `${baseUrl}/api/subscribers/unsubscribe?id=${encodedId}`;
    const supportEmail = getSupportEmail();

    const subject = `${storeName}: подписка на новости`;
    const text = `Спасибо за подписку на рассылку ${storeName}!

Вы будете получать:
- новости коллекций и новинки
- закрытые скидки и акции
- напоминания о самых популярных товарах

Если хотите отписаться: ${unsubscribeUrl}`;
    const html = `
        <div style="background: #fafafa; padding: 24px 12px; font-family: Arial, sans-serif; color: #2d2d2d;">
            <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e8e8e8; border-radius: 12px; padding: 24px;">
                <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #c9a26c;">${storeName}</div>
                <h2 style="margin: 10px 0 12px; font-weight: 400;">Спасибо за подписку!</h2>
                <p style="margin: 0 0 12px; line-height: 1.6;">
                    Теперь вы будете первыми узнавать о новинках, специальных предложениях и закрытых скидках.
                </p>
                <div style="background: #f7f5f1; border-radius: 10px; padding: 14px 16px; margin: 16px 0;">
                    <ul style="margin: 0; padding-left: 18px; line-height: 1.6;">
                        <li>Новые коллекции и подборки недели</li>
                        <li>Ранний доступ к распродажам</li>
                        <li>Полезные советы по уходу и стилю</li>
                    </ul>
                </div>
                <p style="margin: 0 0 16px;">Есть вопросы? Напишите нам на <a href="mailto:${supportEmail}" style="color: #2d2d2d;">${supportEmail}</a>.</p>
                <a href="${baseUrl}" style="display: inline-block; background: #2d2d2d; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 999px; font-size: 14px;">Перейти в магазин</a>
                <div style="border-top: 1px solid #eee; margin: 20px 0;"></div>
                <p style="font-size: 12px; color: #6b6b6b; margin: 0 0 10px;">
                    Вы получили это письмо, потому что подписались на рассылку.
                </p>
                <a href="${unsubscribeUrl}" style="display: inline-block; border: 1px solid #c9a26c; color: #c9a26c; text-decoration: none; padding: 10px 16px; border-radius: 999px; font-size: 12px;">Отписаться от рассылки</a>
            </div>
        </div>
    `;

    await mailer.sendMail({
        from: smtpConfig.from,
        to,
        subject,
        text,
        html
    });

    return true;
};

export const sendOrderConfirmationEmail = async ({
    to,
    orderNumber,
    customerName,
    items,
    total,
    shippingAddress,
    storeName = 'AURA'
}) => {
    const mailer = ensureTransporter();
    if (!mailer) return false;

    const subject = `${storeName}: заказ ${orderNumber} оформлен`;
    const text = `Ваш заказ ${orderNumber} принят. Сумма: ${formatPrice(total)}.`;
    const itemsTable = formatItemsTable(items);

    const html = `
        <div style="font-family: Arial, sans-serif; color: #2d2d2d;">
            <h2 style="margin: 0 0 12px;">Спасибо за заказ!</h2>
            <p>Здравствуйте${customerName ? `, ${customerName}` : ''}! Мы приняли ваш заказ.</p>
            <p><strong>Номер заказа:</strong> ${orderNumber}</p>
            ${shippingAddress ? `<p><strong>Адрес доставки:</strong> ${shippingAddress}</p>` : ''}
            ${itemsTable}
            <p style="margin-top: 12px;"><strong>Итого:</strong> ${formatPrice(total)}</p>
            <p>Мы сообщим о дальнейших обновлениях статуса.</p>
        </div>
    `;

    await mailer.sendMail({
        from: smtpConfig.from,
        to,
        subject,
        text,
        html
    });

    return true;
};

export const sendOrderStatusEmail = async ({
    to,
    orderNumber,
    customerName,
    status,
    storeName = 'AURA'
}) => {
    const mailer = ensureTransporter();
    if (!mailer) return false;

    const statusLabel = getStatusLabel(status);
    const subject = `${storeName}: статус заказа ${orderNumber} обновлен`;
    const text = `Статус заказа ${orderNumber}: ${statusLabel}.`;

    const html = `
        <div style="font-family: Arial, sans-serif; color: #2d2d2d;">
            <h2 style="margin: 0 0 12px;">Статус заказа обновлен</h2>
            <p>Здравствуйте${customerName ? `, ${customerName}` : ''}!</p>
            <p>Статус вашего заказа <strong>${orderNumber}</strong> теперь: <strong>${statusLabel}</strong>.</p>
            <p>Если у вас есть вопросы, ответьте на это письмо.</p>
        </div>
    `;

    await mailer.sendMail({
        from: smtpConfig.from,
        to,
        subject,
        text,
        html
    });

    return true;
};

export const sendTestEmail = async ({ to, storeName = 'AURA' }) => {
    const mailer = ensureTransporter();
    if (!mailer) return false;

    const subject = `${storeName}: тест SMTP подключения`;
    const text = 'SMTP подключение успешно.';
    const html = `
        <div style="font-family: Arial, sans-serif; color: #2d2d2d;">
            <h2 style="margin: 0 0 12px;">SMTP тест</h2>
            <p>Подключение к SMTP серверу настроено корректно.</p>
        </div>
    `;

    await mailer.sendMail({
        from: smtpConfig.from,
        to,
        subject,
        text,
        html
    });

    return true;
};
