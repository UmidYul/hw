import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

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

export const sendNewsletterWelcomeEmail = async ({ to, storeName = 'AURA' }) => {
    const mailer = ensureTransporter();
    if (!mailer) return false;

    const subject = `${storeName}: подписка на новости`;
    const text = `Спасибо за подписку на рассылку ${storeName}!`;
    const html = `
        <div style="font-family: Arial, sans-serif; color: #2d2d2d;">
            <h2 style="margin: 0 0 12px;">Спасибо за подписку!</h2>
            <p>Теперь вы будете первыми узнавать о новинках и акциях ${storeName}.</p>
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
