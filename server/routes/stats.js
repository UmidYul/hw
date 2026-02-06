import express from 'express';
import { dbAll, dbGet, dbRun } from '../database/db.js';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();

// Get dashboard statistics
router.get('/dashboard', requireAdmin, async (req, res) => {
    try {
        const { period = '30' } = req.query; // days
        const daysAgo = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);

        // Total revenue
        const revenueResult = await dbGet(`
            SELECT COALESCE(SUM(total), 0) as total_revenue,
                   COUNT(*) as total_orders
            FROM orders
            WHERE created_at >= NOW() - INTERVAL '${daysAgo} days'
        `);

        // Previous period revenue for comparison
        const prevRevenueResult = await dbGet(`
                        SELECT COALESCE(SUM(total), 0) as total_revenue
                        FROM orders
                        WHERE created_at >= NOW() - INTERVAL '${daysAgo * 2} days'
                            AND created_at < NOW() - INTERVAL '${daysAgo} days'
                `);

        // Average order value
        const avgOrder = revenueResult.total_orders > 0
            ? revenueResult.total_revenue / revenueResult.total_orders
            : 0;

        // Total customers
        const customersResult = await dbGet(`
            SELECT COUNT(DISTINCT id) as total_customers
            FROM customers
        `);

        // Total products
        const productsResult = await dbGet(`
            SELECT COUNT(*) as total_products
            FROM products
        `);

        // Top products by revenue
        const topProducts = await dbAll(`
            SELECT 
                p.id,
                p.title,
                p.sku,
                p.price,
                SUM((item.value->>'quantity')::int) as total_sold,
                SUM((item.value->>'quantity')::int * (item.value->>'price')::numeric) as revenue
            FROM orders o
            CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item(value)
            JOIN products p ON p.id = (item.value->>'productId')::int
            WHERE o.created_at >= NOW() - INTERVAL '${daysAgo} days'
            GROUP BY p.id
            ORDER BY revenue DESC
            LIMIT 5
        `);

        // Recent orders
        const recentOrders = await dbAll(`
            SELECT 
                id,
                order_number,
                customer_name,
                customer_phone,
                total,
                status,
                created_at
            FROM orders
            ORDER BY created_at DESC
            LIMIT 10
        `);

        // Orders by status
        const ordersByStatus = await dbAll(`
            SELECT 
                status,
                COUNT(*) as count,
                SUM(total) as revenue
            FROM orders
            WHERE created_at >= NOW() - INTERVAL '${daysAgo} days'
            GROUP BY status
        `);

        // Daily revenue for chart (last 7 days)
        const dailyRevenue = await dbAll(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as orders,
                SUM(total) as revenue
            FROM orders
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Calculate changes
        const revenueChange = prevRevenueResult.total_revenue > 0
            ? ((revenueResult.total_revenue - prevRevenueResult.total_revenue) / prevRevenueResult.total_revenue) * 100
            : 0;

        res.json({
            revenue: {
                total: Math.round(revenueResult.total_revenue || 0),
                change: Math.round(revenueChange * 10) / 10,
                previous: Math.round(prevRevenueResult.total_revenue || 0)
            },
            orders: {
                total: revenueResult.total_orders || 0,
                change: 0 // можно добавить сравнение с предыдущим периодом
            },
            avgOrder: Math.round(avgOrder || 0),
            customers: customersResult.total_customers || 0,
            products: productsResult.total_products || 0,
            topProducts: topProducts || [],
            recentOrders: recentOrders || [],
            ordersByStatus: ordersByStatus || [],
            dailyRevenue: dailyRevenue || []
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
