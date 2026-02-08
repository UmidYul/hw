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

const normalizePublicUrl = (value, baseUrl) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('/')) return `${baseUrl}${trimmed}`;
    return trimmed;
};

const escapeHtml = (value) => {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const formatParagraphs = (value) => {
    const safe = escapeHtml(value || '');
    return safe.replace(/\n/g, '<br>');
};

export const sendAdminTwoFactorEmail = async ({
    to,
    code,
    reason = 'login',
    storeName = 'Higher Waist'
}) => {
    const mailer = ensureTransporter();
    if (!mailer) return false;

    const subject = reason === 'setup'
        ? `${storeName}: подтверждение 2FA`
        : `${storeName}: код входа в админку`;

    const text = reason === 'setup'
        ? `Ваш код подтверждения 2FA: ${code}. Он действителен 10 минут.`
        : `Ваш код входа в админку: ${code}. Он действителен 10 минут.`;

    const html = `
        <div style="background: #f7f4f0; padding: 24px 12px; font-family: Arial, sans-serif; color: #2d2d2d;">
            <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #ece6dd; border-radius: 12px; padding: 22px;">
                <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #c9a26c;">${storeName}</div>
                <h2 style="margin: 10px 0 12px; font-weight: 500;">${reason === 'setup' ? 'Подтверждение 2FA' : 'Вход в админку'}</h2>
                <p style="margin: 0 0 12px; line-height: 1.6;">
                    ${reason === 'setup'
            ? 'Используйте код ниже, чтобы включить двухфакторную защиту.'
            : 'Введите код ниже, чтобы завершить вход в админку.'}
                </p>
                <div style="font-size: 28px; letter-spacing: 4px; font-weight: 600; padding: 12px 16px; border-radius: 10px; background: #f7f5f1; display: inline-block;">
                    ${code}
                </div>
                <p style="margin: 16px 0 0; font-size: 12px; color: #6b6b6b;">Код действителен 10 минут.</p>
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

const getNewsletterCategory = (category) => {
    const map = {
        promo: { label: 'Акции', color: '#9a2f2f', bg: '#fde7e7' },
        collection: { label: 'Коллекции', color: '#2d2d2d', bg: '#f2f2f2' },
        news: { label: 'Новости', color: '#1d4f9a', bg: '#e8f0ff' }
    };

    return map[category] || { label: 'Новости', color: '#1d4f9a', bg: '#e8f0ff' };
};

export const sendNewsletterWelcomeEmail = async ({ to, storeName = 'Higher Waist', unsubscribeId = '' }) => {
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
    storeName = 'Higher Waist'
}) => {
    const mailer = ensureTransporter();
    if (!mailer) return false;

    const subject = `${storeName}: заказ ${orderNumber} оформлен`;
    const text = `Ваш заказ ${orderNumber} принят. Сумма: ${formatPrice(total)}.`;
    const itemsTable = formatItemsTable(items);
    const supportEmail = getSupportEmail();

    const html = `
        <div style="background: #f7f4f0; padding: 28px 12px; font-family: Arial, sans-serif; color: #2d2d2d;">
            <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #ece6dd; border-radius: 14px; overflow: hidden;">
                <div style="padding: 18px 24px; border-bottom: 1px solid #f0e9df; background: #faf7f2;">
                    <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #c9a26c;">${storeName}</div>
                </div>
                <div style="padding: 24px;">
                    <h2 style="margin: 0 0 8px; font-weight: 500; font-size: 26px;">Спасибо за заказ!</h2>
                    <p style="margin: 0 0 12px; font-size: 15px; color: #5c5c5c;">Здравствуйте${customerName ? `, ${customerName}` : ''}! Мы приняли ваш заказ.</p>
                    <div style="display: inline-block; padding: 6px 12px; border-radius: 999px; font-size: 12px; background: #f2f2f2; color: #2d2d2d; margin-bottom: 16px;">
                        Заказ № ${orderNumber}
                    </div>
                    ${shippingAddress ? `<p style="margin: 0 0 14px;"><strong>Адрес доставки:</strong> ${shippingAddress}</p>` : ''}
                    ${itemsTable}
                    <div style="margin-top: 16px; font-size: 16px;">
                        <strong>Итого:</strong> ${formatPrice(total)}
                    </div>
                    <p style="margin: 14px 0 0; color: #5c5c5c;">Мы сообщим о дальнейших обновлениях статуса.</p>
                </div>
                <div style="padding: 18px 24px; border-top: 1px solid #f0e9df; background: #faf7f2;">
                    <p style="margin: 0; font-size: 12px; color: #6b6b6b;">Есть вопросы? Напишите на <a href="mailto:${supportEmail}" style="color: #2d2d2d;">${supportEmail}</a>.</p>
                </div>
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

export const sendOrderStatusEmail = async ({
    to,
    orderNumber,
    customerName,
    status,
    items,
    subtotal,
    discount,
    shipping,
    total,
    shippingAddress,
    storeName = 'Higher Waist'
}) => {
    const mailer = ensureTransporter();
    if (!mailer) return false;

    const statusLabel = getStatusLabel(status);
    const subject = `${storeName}: статус заказа ${orderNumber} обновлен`;
    const text = `Статус заказа ${orderNumber}: ${statusLabel}.`;
    const supportEmail = getSupportEmail();
    const itemsTable = formatItemsTable(items);
    const subtotalValue = Number(subtotal || 0);
    const discountValue = Number(discount || 0);
    const shippingValue = Number(shipping || 0);
    const totalValue = Number(total || 0);

    const html = `
        <div style="background: #f7f4f0; padding: 28px 12px; font-family: Arial, sans-serif; color: #2d2d2d;">
            <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #ece6dd; border-radius: 14px; overflow: hidden;">
                <div style="padding: 18px 24px; border-bottom: 1px solid #f0e9df; background: #faf7f2;">
                    <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #c9a26c;">${storeName}</div>
                </div>
                <div style="padding: 24px;">
                    <h2 style="margin: 0 0 8px; font-weight: 500; font-size: 24px;">Статус заказа обновлен</h2>
                    <p style="margin: 0 0 12px; color: #5c5c5c;">Здравствуйте${customerName ? `, ${customerName}` : ''}!</p>
                    <div style="display: inline-block; padding: 6px 12px; border-radius: 999px; font-size: 12px; background: #e8f0ff; color: #1d4f9a; margin-bottom: 12px;">
                        Заказ № ${orderNumber}
                    </div>
                    <p style="margin: 0; font-size: 16px;">Текущий статус: <strong>${statusLabel}</strong>.</p>
                    ${shippingAddress ? `<p style="margin: 12px 0 0;"><strong>Адрес доставки:</strong> ${shippingAddress}</p>` : ''}
                    ${itemsTable}
                    <div style="margin-top: 14px; font-size: 14px; color: #5c5c5c;">
                        ${subtotalValue ? `<div>Подытог: ${formatPrice(subtotalValue)}</div>` : ''}
                        ${discountValue ? `<div>Скидка: -${formatPrice(discountValue)}</div>` : ''}
                        ${shippingValue ? `<div>Доставка: ${formatPrice(shippingValue)}</div>` : ''}
                        ${totalValue ? `<div style="margin-top: 6px; font-size: 16px; color: #2d2d2d;"><strong>Итого:</strong> ${formatPrice(totalValue)}</div>` : ''}
                    </div>
                </div>
                <div style="padding: 18px 24px; border-top: 1px solid #f0e9df; background: #faf7f2;">
                    <p style="margin: 0; font-size: 12px; color: #6b6b6b;">Если у вас есть вопросы, ответьте на это письмо или напишите на <a href="mailto:${supportEmail}" style="color: #2d2d2d;">${supportEmail}</a>.</p>
                </div>
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

export const sendTestEmail = async ({ to, storeName = 'Higher Waist' }) => {
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

export const sendNewsletterCampaignEmail = async ({
    to,
    unsubscribeId,
    campaign,
    storeName = 'Higher Waist',
    supportEmail
}) => {
    const mailer = ensureTransporter();
    if (!mailer) return false;

    const baseUrl = getBaseUrl();
    const encodedId = encodeURIComponent(String(unsubscribeId || '').trim());
    const unsubscribeUrl = `${baseUrl}/api/subscribers/unsubscribe?id=${encodedId}`;
    const support = supportEmail || getSupportEmail();

    const categoryMeta = getNewsletterCategory(campaign?.category);
    const subject = campaign?.subject || `${storeName}: новости`;
    const title = escapeHtml(campaign?.title || 'Новости');
    const subtitle = escapeHtml(campaign?.subtitle || '');
    const body = campaign?.body ? formatParagraphs(campaign.body) : '';
    const ctaLabel = escapeHtml(campaign?.cta_label || 'Перейти');
    const ctaUrl = campaign?.cta_url ? String(campaign.cta_url) : '';
    const heroImage = campaign?.hero_image ? normalizePublicUrl(campaign.hero_image, baseUrl) : '';
    console.log(heroImage);

    const preheader = escapeHtml(campaign?.subtitle || campaign?.title || 'Новости магазина');

    const html = `
        <div style="background: #f7f4f0; padding: 28px 12px; font-family: Arial, sans-serif; color: #2d2d2d;">
            <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #ece6dd; border-radius: 14px; overflow: hidden;">
                <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${preheader}</div>
                <div style="padding: 18px 24px; border-bottom: 1px solid #f0e9df; background: #faf7f2;">
                    <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #c9a26c;">${escapeHtml(storeName)}</div>
                </div>
                ${heroImage ? `
                    <img src="${heroImage}" alt="${title}" style="width: 100%; display: block; object-fit: cover; max-height: 320px;">
                ` : ''}
                <div style="padding: 24px;">
                    <div style="display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; background: ${categoryMeta.bg}; color: ${categoryMeta.color};">
                        ${categoryMeta.label}
                    </div>
                    <h2 style="margin: 16px 0 8px; font-weight: 500; font-size: 26px;">${title}</h2>
                    ${subtitle ? `<p style="margin: 0 0 16px; font-size: 15px; color: #5c5c5c;">${subtitle}</p>` : ''}
                    ${body ? `<p style="margin: 0 0 20px; line-height: 1.7; font-size: 15px; color: #2d2d2d;">${body}</p>` : ''}
                    ${ctaUrl ? `
                        <a href="${ctaUrl}" style="display: inline-block; background: #2d2d2d; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 999px; font-size: 13px; letter-spacing: 0.5px;">
                            ${ctaLabel}
                        </a>
                    ` : ''}
                </div>
                <div style="padding: 18px 24px; border-top: 1px solid #f0e9df; background: #faf7f2;">
                    <p style="margin: 0 0 10px; font-size: 12px; color: #6b6b6b;">Есть вопросы? Напишите на <a href="mailto:${support}" style="color: #2d2d2d;">${support}</a>.</p>
                    <a href="${unsubscribeUrl}" style="display: inline-block; font-size: 12px; color: #c9a26c; text-decoration: none; border: 1px solid #c9a26c; padding: 8px 14px; border-radius: 999px;">Отписаться</a>
                </div>
            </div>
        </div>
    `;

    const text = `${storeName}: ${campaign?.title || 'Новости'}\n\n${campaign?.subtitle || ''}\n\n${campaign?.body || ''}\n\n${campaign?.cta_url ? `Ссылка: ${campaign.cta_url}` : ''}\n\nОтписаться: ${unsubscribeUrl}`;

    await mailer.sendMail({
        from: smtpConfig.from,
        to,
        subject,
        text,
        html
    });

    return true;
};
