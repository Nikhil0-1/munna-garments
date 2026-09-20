const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);
  const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().substring(0, 7);

  // Today's stats
  const todaySales = db.prepare(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as revenue,
      COALESCE(SUM(gst_amount), 0) as gst
    FROM sales WHERE date = ? AND status = 'Completed'
  `).get(today);

  const todayProfit = db.prepare(`
    SELECT COALESCE(SUM(si.profit), 0) as profit
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.date = ? AND s.status = 'Completed'
  `).get(today);

  const todayExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as amount FROM expenses WHERE date = ?
  `).get(today);

  // Stock value
  const stockValue = db.prepare(`
    SELECT COALESCE(SUM(pv.stock * COALESCE(pv.selling_price, p.selling_price)), 0) as value
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.active = 1
  `).get();

  const stockCount = db.prepare(`
    SELECT COALESCE(SUM(pv.stock), 0) as total
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.active = 1
  `).get();

  // Customers & receivables
  const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers WHERE active = 1').get();
  
  const receivables = db.prepare(`
    SELECT COALESCE(SUM(due_amount), 0) as amount FROM sales WHERE due_amount > 0 AND status = 'Completed'
  `).get();

  const payables = db.prepare(`
    SELECT COALESCE(SUM(due_amount), 0) as amount FROM purchases WHERE due_amount > 0 AND status = 'Completed'
  `).get();

  // Low stock
  const lowStock = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as count
    FROM products p
    JOIN product_variants pv ON pv.product_id = p.id
    WHERE p.active = 1
    GROUP BY p.id
    HAVING SUM(pv.stock) <= p.min_stock
  `).all();

  // Monthly sales (last 12 months)
  const monthlySales = db.prepare(`
    SELECT 
      strftime('%Y-%m', date) as month,
      COALESCE(SUM(total_amount), 0) as revenue,
      COUNT(*) as count
    FROM sales 
    WHERE date >= date('now', '-12 months') AND status = 'Completed'
    GROUP BY month
    ORDER BY month ASC
  `).all();

  const monthlyProfit = db.prepare(`
    SELECT 
      strftime('%Y-%m', s.date) as month,
      COALESCE(SUM(si.profit), 0) as profit
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.date >= date('now', '-12 months') AND s.status = 'Completed'
    GROUP BY month
    ORDER BY month ASC
  `).all();

  // Daily sales (last 30 days)
  const dailySales = db.prepare(`
    SELECT 
      date,
      COALESCE(SUM(total_amount), 0) as revenue,
      COUNT(*) as count
    FROM sales 
    WHERE date >= date('now', '-30 days') AND status = 'Completed'
    GROUP BY date
    ORDER BY date ASC
  `).all();

  // Top products
  const topProducts = db.prepare(`
    SELECT 
      si.product_name,
      SUM(si.quantity) as total_qty,
      SUM(si.total_amount) as total_revenue
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.date >= date('now', '-30 days') AND s.status = 'Completed'
    GROUP BY si.product_name
    ORDER BY total_qty DESC
    LIMIT 5
  `).all();

  // Category sales
  const categorySales = db.prepare(`
    SELECT 
      c.name as category,
      SUM(si.quantity) as qty,
      SUM(si.total_amount) as revenue
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE s.date >= date('now', '-30 days') AND s.status = 'Completed'
    GROUP BY c.name
    ORDER BY revenue DESC
    LIMIT 6
  `).all();

  // Payment method breakdown
  const paymentBreakdown = db.prepare(`
    SELECT payment_method, COUNT(*) as count, SUM(total_amount) as amount
    FROM sales WHERE date >= date('now', '-30 days') AND status = 'Completed'
    GROUP BY payment_method
  `).all();

  // Recent transactions
  const recentSales = db.prepare(`
    SELECT id, invoice_number, customer_name, total_amount, paid_amount, due_amount, 
           payment_method, date, status
    FROM sales ORDER BY id DESC LIMIT 10
  `).all();

  // Low stock products
  const lowStockProducts = db.prepare(`
    SELECT p.id, p.name, p.sku, p.min_stock, COALESCE(SUM(pv.stock), 0) as current_stock
    FROM products p
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    WHERE p.active = 1
    GROUP BY p.id
    HAVING current_stock <= p.min_stock
    ORDER BY current_stock ASC
    LIMIT 5
  `).all();

  // This month vs last month
  const thisMonthRevenue = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as revenue
    FROM sales WHERE strftime('%Y-%m', date) = ? AND status = 'Completed'
  `).get(thisMonth);

  const lastMonthRevenue = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as revenue
    FROM sales WHERE strftime('%Y-%m', date) = ? AND status = 'Completed'
  `).get(lastMonth);

  const revenueGrowth = lastMonthRevenue.revenue > 0 
    ? ((thisMonthRevenue.revenue - lastMonthRevenue.revenue) / lastMonthRevenue.revenue) * 100 
    : 0;

  res.json({
    today: {
      sales: todaySales.count,
      revenue: todaySales.revenue,
      profit: todayProfit.profit - todayExpenses.amount,
      expenses: todayExpenses.amount,
    },
    stock: {
      value: stockValue.value,
      count: stockCount.total,
    },
    customers: totalCustomers.count,
    receivables: receivables.amount,
    payables: payables.amount,
    lowStockCount: lowStock.length,
    charts: {
      monthlySales,
      monthlyProfit,
      dailySales,
      topProducts,
      categorySales,
      paymentBreakdown,
    },
    recentSales,
    lowStockProducts,
    growth: {
      thisMonthRevenue: thisMonthRevenue.revenue,
      lastMonthRevenue: lastMonthRevenue.revenue,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    },
  });
});

module.exports = router;
