import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();


// Telegram bot configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SERVER_URL = process.env.SERVER_URL || 'https://higherwaist.uz';

/**
 * Send message to Telegram
 */
async function sendTelegramMessage(text, parseMode = 'HTML', replyMarkup = null) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

        const body = {
            chat_id: TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: parseMode,
        };

        if (replyMarkup) {
            body.reply_markup = replyMarkup;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!data.ok) {
            console.error('Telegram API error:', data);
            return { success: false, error: data.description };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Failed to send Telegram message:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Format order notification for Telegram
 */
function formatOrderNotification(order) {
    const {
        orderNumber,
        customerName,
        customerPhone,
        total,
        items,
        shippingAddress,
        subtotal,
        discount,
        shipping
    } = order;

    let itemsList = '';
    items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        const sizePart = item.size ? `, размер: ${item.size}` : '';
        const colorPart = item.color ? `, цвет: ${item.color}` : '';
        itemsList += `  • ${item.title || item.name}\n`;
        itemsList += `    ${item.quantity} шт × ${formatPrice(item.price)} = ${formatPrice(itemTotal)}${sizePart}${colorPart}\n`;
    });

    const hasSubtotal = Number(subtotal || 0) > 0;
    const discountValue = Number(discount || 0);
    const shippingValue = Number(shipping || 0);
    const subtotalLine = hasSubtotal
        ? `\n🧾 <b>Подытог:</b> ${formatPrice(subtotal)} Сумм`
        : '';
    const discountLine = discountValue > 0
        ? `\n🏷️ <b>Скидка:</b> -${formatPrice(discountValue)} Сумм`
        : '';
    const shippingLine = shippingValue > 0
        ? `\n🚚 <b>Доставка:</b> ${formatPrice(shippingValue)} Сумм`
        : '';

    const message = `
🛍️ <b>НОВЫЙ ЗАКАЗ!</b>

📋 <b>Номер:</b> ${orderNumber}
👤 <b>Клиент:</b> ${customerName}
📞 <b>Телефон:</b> <code>${customerPhone}</code>

<b>Товары:</b>
${itemsList}${subtotalLine}${discountLine}${shippingLine}
💰 <b>Итого:</b> ${formatPrice(total)} Сумм

📍 <b>Адрес доставки:</b>
${shippingAddress || 'Не указан'}

⏰ Время заказа: ${new Date().toLocaleString('ru-RU')}
`;

    return message.trim();
}

/**
 * Format order status change notification
 */
function formatStatusChangeNotification(order, oldStatus, newStatus) {
    console.log('formatStatusChangeNotification called with:', {
        order,
        oldStatus,
        newStatus
    });

    const statusEmojis = {
        pending: '⏳',
        processing: '🔄',
        shipped: '🚚',
        delivered: '✅',
        completed: '✅',
        cancelled: '❌'
    };

    const statusNames = {
        pending: 'Ожидание',
        processing: 'В обработке',
        shipped: 'Отправлен',
        delivered: 'Доставлен',
        completed: 'Выполнен',
        cancelled: 'Отменён'
    };

    const oldStatusEmoji = statusEmojis[oldStatus] || '●';
    const newStatusEmoji = statusEmojis[newStatus] || '●';
    const oldStatusName = statusNames[oldStatus] || oldStatus || 'Неизвестно';
    const newStatusName = statusNames[newStatus] || newStatus || 'Неизвестно';

    const message = `
📦 <b>ИЗМЕНЕНИЕ СТАТУСА ЗАКАЗА</b>

📋 <b>Номер:</b> ${order.orderNumber || order.order_number}
👤 <b>Клиент:</b> ${order.customerName || order.customer_name}
📞 <b>Телефон:</b> <code>${order.customerPhone || order.customer_phone || 'Не указан'}</code>

${oldStatusEmoji} ${oldStatusName} → ${newStatusEmoji} ${newStatusName}

⏰ ${new Date().toLocaleString('ru-RU')}
`;

    return message.trim();
}

/**
 * Format price
 */
function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU').format(price);
}

/**
 * Send new order notification
 */
export async function notifyNewOrder(order) {
    const message = formatOrderNotification(order);

    // Create inline keyboard with button to open order
    const inlineKeyboard = {
        inline_keyboard: [
            [
                {
                    text: '📋 Открыть заказ',
                    url: `${SERVER_URL}/admin/order-view?id=${order.orderId}`
                }
            ]
        ]
    };

    return await sendTelegramMessage(message, 'HTML', inlineKeyboard);
}

/**
 * Send order status change notification
 */
export async function notifyStatusChange(order, oldStatus, newStatus) {
    const message = formatStatusChangeNotification(order, oldStatus, newStatus);

    // Create inline keyboard with button to open order
    const inlineKeyboard = {
        inline_keyboard: [
            [
                {
                    text: '📋 Открыть заказ',
                    url: `${SERVER_URL}/admin/order-view?id=${order.orderId}`
                }
            ]
        ]
    };

    return await sendTelegramMessage(message, 'HTML', inlineKeyboard);
}

/**
 * Send custom notification
 */
export async function sendNotification(text) {
    return await sendTelegramMessage(text);
}

export default {
    notifyNewOrder,
    notifyStatusChange,
    sendNotification
};
