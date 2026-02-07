import express from 'express';
import crypto from 'crypto';
import { dbAll, dbGet, dbRun } from '../database/db.js';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();

const parseJsonField = (value, fallback) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
};

const initContentSettingsTable = async () => {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS content_settings (
            id UUID PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            value JSONB,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

initContentSettingsTable().catch(console.error);

const DEFAULT_INFO_PAGES = {
    delivery: {
        title: 'Доставка',
        meta: '',
        sections: [
            {
                title: 'Сроки доставки',
                body: '<p>Мы отправляем заказы ежедневно. Срок зависит от региона и обычно составляет от 1 до 5 рабочих дней.</p>'
            },
            {
                title: 'Стоимость',
                body: '<p>Стоимость доставки рассчитывается при оформлении заказа. Для заказов от порога бесплатной доставки действует бесплатная доставка.</p>'
            },
            {
                title: 'Отслеживание',
                body: '<p>После отправки вы получите трек-номер. Проверяйте статус доставки в личных сообщениях или по ссылке от курьерской службы.</p>'
            },
            {
                title: 'Получение заказа',
                body: '<p>Проверьте целостность упаковки и комплектацию заказа при получении. Если есть вопросы — свяжитесь с нами.</p>'
            }
        ]
    },
    payment: {
        title: 'Оплата',
        meta: '',
        sections: [
            {
                title: 'Способы оплаты',
                body: '<p>Мы принимаем банковские карты, онлайн-переводы и безопасные платежные системы.</p>'
            },
            {
                title: 'Безопасность',
                body: '<p>Платежи проходят через защищенные каналы, данные карты не сохраняются на сайте.</p>'
            },
            {
                title: 'Подтверждение оплаты',
                body: '<p>После успешной оплаты мы отправим подтверждение на email или в мессенджер.</p>'
            },
            {
                title: 'Если оплата не прошла',
                body: '<p>Попробуйте повторить позже или используйте другой способ. Мы готовы помочь через раздел контактов.</p>'
            }
        ]
    },
    returns: {
        title: 'Возврат и обмен',
        meta: '',
        sections: [
            {
                title: 'Срок возврата',
                body: '<p>Вы можете вернуть товар в течение 14 дней с момента получения, если он не был в использовании.</p>'
            },
            {
                title: 'Условия возврата',
                body: '<p>Сохраните бирки и упаковку, приложите чек или подтверждение заказа.</p>'
            },
            {
                title: 'Как оформить возврат',
                body: '<ol><li>Свяжитесь с нами через раздел контактов.</li><li>Укажите номер заказа и причину возврата.</li><li>Мы подтвердим адрес и способ отправки.</li></ol>'
            },
            {
                title: 'Обмен',
                body: '<p>Если нужен другой размер или цвет, мы быстро поможем оформить обмен.</p>'
            }
        ]
    },
    faq: {
        title: 'Частые вопросы',
        meta: '',
        sections: [
            {
                title: 'Как выбрать размер?',
                body: '<p>Ориентируйтесь на описание товара и таблицу размеров. Если сомневаетесь, напишите нам.</p>'
            },
            {
                title: 'Можно ли примерить перед покупкой?',
                body: '<p>Возможность примерки зависит от способа доставки. Уточните при оформлении заказа.</p>'
            },
            {
                title: 'Как отследить заказ?',
                body: '<p>После отправки мы пришлем трек-номер и ссылку для отслеживания.</p>'
            },
            {
                title: 'Как оформить возврат?',
                body: '<p>Свяжитесь с нами через контакты, укажите номер заказа и причину возврата.</p>'
            }
        ]
    },
    privacy: {
        title: 'Политика конфиденциальности',
        meta: 'Последнее обновление: 07.02.2026',
        sections: [
            {
                title: 'Какие данные мы собираем',
                body: '<p>Мы собираем данные, необходимые для оформления заказа, связи с вами и улучшения сервиса.</p>'
            },
            {
                title: 'Как мы используем данные',
                body: '<p>Информация используется для обработки заказов, доставки и поддержки клиентов.</p>'
            },
            {
                title: 'Передача третьим лицам',
                body: '<p>Мы передаем данные только партнерам, которые обеспечивают оплату и доставку.</p>'
            },
            {
                title: 'Ваши права',
                body: '<p>Вы можете запросить изменение или удаление данных, обратившись через контакты.</p>'
            }
        ]
    },
    terms: {
        title: 'Публичная оферта',
        meta: 'Последнее обновление: 07.02.2026',
        sections: [
            {
                title: '1. Общие положения',
                body: '<p>Настоящая оферта является официальным предложением магазина Higher Waist и определяет условия продажи товаров.</p>'
            },
            {
                title: '2. Оформление заказа',
                body: '<p>Заказ оформляется через сайт. Покупатель подтверждает корректность контактных данных.</p>'
            },
            {
                title: '3. Оплата и доставка',
                body: '<p>Оплата производится выбранным способом. Доставка выполняется в согласованные сроки.</p>'
            },
            {
                title: '4. Возврат',
                body: '<p>Возврат и обмен осуществляются согласно правилам на странице возврата.</p>'
            },
            {
                title: '5. Контакты',
                body: '<p>Для вопросов используйте контакты, указанные на сайте.</p>'
            }
        ]
    },
    contacts: {
        title: 'Контакты',
        meta: '',
        sections: [
            {
                title: 'Как с нами связаться',
                body: '<p>Мы на связи каждый день и готовы помочь с подбором, оплатой и доставкой.</p>'
            },
            {
                title: 'Телефон',
                body: '<p id="contactPhoneInline">Уточняйте внизу страницы.</p>'
            },
            {
                title: 'Email',
                body: '<p id="contactEmailInline">Уточняйте внизу страницы.</p>'
            },
            {
                title: 'Социальные сети',
                body: '<p>Подписывайтесь на нас в социальных сетях — ссылки доступны в футере.</p>'
            }
        ]
    },
    about: {
        title: 'О нас',
        meta: '',
        sections: [
            {
                title: 'Наша философия',
                body: '<p>Higher Waist — это минимализм, чистые линии и внимание к деталям. Мы создаем вещи, которые легко комбинировать каждый день.</p>'
            },
            {
                title: 'Материалы и качество',
                body: '<p>Мы выбираем ткани, которые приятно носить, и уделяем внимание пошиву, чтобы одежда служила долго.</p>'
            },
            {
                title: 'Подход к стилю',
                body: '<p>В центре каждой коллекции — удобство и уверенность. Мы любим простоту, но не теряем характер.</p>'
            }
        ]
    }
};

const getInfoPagesSetting = async () => {
    const setting = await dbGet('SELECT * FROM content_settings WHERE key = ?', ['infoPages']);
    return setting ? parseJsonField(setting.value, {}) : {};
};

const mergeInfoPages = (stored) => {
    const merged = {};
    const allSlugs = new Set([...Object.keys(DEFAULT_INFO_PAGES), ...Object.keys(stored || {})]);
    allSlugs.forEach((slug) => {
        const fallback = DEFAULT_INFO_PAGES[slug] || { title: slug, meta: '', sections: [] };
        const current = stored?.[slug] || {};
        merged[slug] = {
            ...fallback,
            ...current,
            sections: Array.isArray(current.sections) ? current.sections : fallback.sections
        };
    });
    return merged;
};

const saveInfoPages = async (pages) => {
    const existing = await dbGet('SELECT * FROM content_settings WHERE key = ?', ['infoPages']);
    if (existing) {
        await dbRun(
            'UPDATE content_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
            [JSON.stringify(pages), 'infoPages']
        );
        return existing.id;
    }

    const settingId = crypto.randomUUID();
    await dbRun(
        'INSERT INTO content_settings (id, key, value) VALUES (?, ?, ?)',
        [settingId, 'infoPages', JSON.stringify(pages)]
    );
    return settingId;
};

router.get('/pages', async (req, res) => {
    try {
        const stored = await getInfoPagesSetting();
        const pages = mergeInfoPages(stored);
        res.json({ pages });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/pages/:slug', async (req, res) => {
    try {
        const stored = await getInfoPagesSetting();
        const pages = mergeInfoPages(stored);
        const page = pages[req.params.slug];
        if (!page) {
            return res.status(404).json({ error: 'Page not found' });
        }
        res.json({ slug: req.params.slug, ...page });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/pages/:slug', requireAdmin, async (req, res) => {
    try {
        const { title, meta, sections } = req.body || {};
        const stored = await getInfoPagesSetting();
        const normalizedSections = Array.isArray(sections)
            ? sections
                .map(section => ({
                    title: String(section?.title || '').trim(),
                    body: String(section?.body || '').trim()
                }))
                .filter(section => section.title || section.body)
            : [];

        const pagePayload = {
            title: title ? String(title).trim() : stored?.[req.params.slug]?.title || DEFAULT_INFO_PAGES?.[req.params.slug]?.title || req.params.slug,
            meta: meta ? String(meta).trim() : '',
            sections: normalizedSections,
            updatedAt: new Date().toISOString()
        };

        const nextPages = {
            ...stored,
            [req.params.slug]: pagePayload
        };

        await saveInfoPages(nextPages);
        res.json({ message: 'Info page updated successfully', page: { slug: req.params.slug, ...pagePayload } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get content setting by key
router.get('/:key', async (req, res) => {
    try {
        const setting = await dbGet('SELECT * FROM content_settings WHERE key = ?', [req.params.key]);

        if (!setting) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json({
            key: setting.key,
            value: parseJsonField(setting.value, null),
            updatedAt: setting.updated_at
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all content settings
router.get('/', async (req, res) => {
    try {
        const settings = await dbAll('SELECT * FROM content_settings');

        const parsed = {};
        settings.forEach(s => {
            parsed[s.key] = parseJsonField(s.value, null);
        });

        res.json(parsed);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get featured collections with full details
router.get('/featured/collections', async (req, res) => {
    try {
        // Get featured collections IDs from content_settings
        const setting = await dbGet('SELECT * FROM content_settings WHERE key = ?', ['featuredCollections']);

        if (!setting || !setting.value) {
            return res.json([]);
        }

        const featuredIds = parseJsonField(setting.value, []);

        if (!Array.isArray(featuredIds) || featuredIds.length === 0) {
            return res.json([]);
        }

        // Get full collection details for featured collections
        const placeholders = featuredIds.map(() => '?').join(',');
        const collections = await dbAll(
            `SELECT * FROM collections WHERE id IN (${placeholders}) AND is_visible = true ORDER BY name`,
            featuredIds
        );

        // For each collection, get product count
        const collectionsWithCount = await Promise.all(
            collections.map(async (collection) => {
                const productIds = parseJsonField(collection.product_ids, []);
                return {
                    ...collection,
                    product_ids: productIds,
                    productCount: productIds.length
                };
            })
        );

        res.json(collectionsWithCount);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update content setting
router.put('/:key', requireAdmin, async (req, res) => {
    try {
        const { value } = req.body;

        // Check if setting exists
        const existing = await dbGet('SELECT * FROM content_settings WHERE key = ?', [req.params.key]);

        if (existing) {
            await dbRun(
                'UPDATE content_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
                [JSON.stringify(value), req.params.key]
            );
        } else {
            const settingId = crypto.randomUUID();
            await dbRun(
                'INSERT INTO content_settings (id, key, value) VALUES (?, ?, ?)',
                [settingId, req.params.key, JSON.stringify(value)]
            );
        }

        res.json({ message: 'Content setting updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
