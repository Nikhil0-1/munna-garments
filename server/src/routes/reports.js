const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/reports/sales
router.get('/sales', (req, res) => {
  const db = getDb();
  const { from, to, group_by = 'day' } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const fromDate = from || new Date(new Date().setDate(1)).toISOString().split('T')[0];
  const toDate = to || today;

  const groupFormat = group_by === 'month' ? '%Y-%m' : group_by === 'week' ? '%Y-W%W' : '%Y-%m-%d';

  const summary = db.prepare(`
    SELECT strftime('${groupFormat}', date) as period,
      COUNT(*) as invoices, COALESCE(SUM(total_amount), 0) as revenue,
      COALESCE(SUM(paid_amount), 0) as collected, COALESCE(SUM(due_amount), 0) as due,
      COALESCE(SUM(discount_amount), 0) as discount, COALESCE(SUM(gst_amount), 0) as gst
    FROM sales WHERE date BETWEEN ? AND ? AND status = 'Completed'
    GROUP BY period ORDER BY period ASC
  `).all(fromDate, toDate);

  const profit = db.prepare(`
    SELECT strftime('${groupFormat}', s.date) as period, COALESCE(SUM(si.profit), 0) as profit
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE s.date BETWEEN ? AND ? AND s.status = 'Completed'
    GROUP BY period ORDER BY period ASC
  `).all(fromDate, toDate);

  const totals = db.prepare(`
    SELECT COUNT(*) as invoices, COALESCE(SUM(total_amount), 0) as revenue,
      COALESCE(SUM(paid_amount), 0) as collected, COALESCE(SUM(due_amount), 0) as due,
      COALESCE(SUM(discount_amount), 0) as discount, COALESCE(SUM(gst_amount), 0) as gst
    FROM sales WHERE date BETWEEN ? AND ? AND status = 'Completed'
  `).get(fromDate, toDate);

  const profitTotal = db.prepare(`
    SELECT COALESCE(SUM(si.profit), 0) as profit
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE s.date BETWEEN ? AND ? AND s.status = 'Completed'
  `).get(fromDate, toDate);

  const topProducts = db.prepare(`
    SELECT si.product_name, SUM(si.quantity) as qty, SUM(si.total_amount) as revenue, SUM(si.profit) as profit
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE s.date BETWEEN ? AND ? AND s.status = 'Completed'
    GROUP BY si.product_name ORDER BY revenue DESC LIMIT 10
  `).all(fromDate, toDate);

  const paymentMethods = db.prepare(`
    SELECT payment_method, COUNT(*) as count, SUM(total_amount) as amount
    FROM sales WHERE date BETWEEN ? AND ? AND status = 'Completed'
    GROUP BY payment_method
  `).all(fromDate, toDate);

  res.json({ summary, profit, totals: { ...totals, profit: profitTotal.profit }, topProducts, paymentMethods, period: { from: fromDate, to: toDate } });
});

// GET /api/reports/inventory
router.get('/inventory', (req, res) => {
  const db = getDb();

  const stockSummary = db.prepare(`
    SELECT p.id, p.name, p.sku, p.min_stock, p.selling_price, p.purchase_price, c.name as category,
      COALESCE(SUM(pv.stock), 0) as current_stock,
      COALESCE(SUM(pv.stock * COALESCE(pv.selling_price, p.selling_price)), 0) as stock_value
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    WHERE p.active = 1
    GROUP BY p.id ORDER BY p.name ASC
  `).all();

  const totalValue = stockSummary.reduce((sum, p) => sum + p.stock_value, 0);
  const lowStock = stockSummary.filter(p => p.current_stock <= p.min_stock && p.current_stock > 0);
  const outOfStock = stockSummary.filter(p => p.current_stock === 0);

  const fastMoving = db.prepare(`
    SELECT si.product_name, SUM(si.quantity) as sold_qty
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE s.date >= date('now', '-30 days') AND s.status = 'Completed'
    GROUP BY si.product_name ORDER BY sold_qty DESC LIMIT 10
  `).all();

  const slowMoving = db.prepare(`
    SELECT p.name, p.sku, COALESCE(SUM(pv.stock), 0) as stock,
      COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.product_id = p.id AND s.date >= date('now', '-30 days')), 0) as sold_qty
    FROM products p LEFT JOIN product_variants pv ON pv.product_id = p.id
    WHERE p.active = 1 GROUP BY p.id HAVING stock > 5 AND sold_qty = 0 ORDER BY stock DESC LIMIT 10
  `).all();

  res.json({ stockSummary, totalValue, lowStock, outOfStock, fastMoving, slowMoving });
});

// GET /api/reports/finance
router.get('/finance', (req, res) => {
  const db = getDb();
  const { from, to } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const fromDate = from || new Date(new Date().setDate(1)).toISOString().split('T')[0];
  const toDate = to || today;

  const revenue = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as value FROM sales WHERE date BETWEEN ? AND ? AND status = 'Completed'`).get(fromDate, toDate);
  const profit = db.prepare(`SELECT COALESCE(SUM(si.profit), 0) as value FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.date BETWEEN ? AND ? AND s.status = 'Completed'`).get(fromDate, toDate);
  const expenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) as value FROM expenses WHERE date BETWEEN ? AND ?`).get(fromDate, toDate);
  const expenseByCategory = db.prepare(`SELECT category, SUM(amount) as total FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC`).all(fromDate, toDate);
  const receivables = db.prepare(`SELECT COALESCE(SUM(due_amount), 0) as value FROM sales WHERE status = 'Completed' AND due_amount > 0`).get();
  const payables = db.prepare(`SELECT COALESCE(SUM(due_amount), 0) as value FROM purchases WHERE status = 'Completed' AND due_amount > 0`).get();
  const gstCollected = db.prepare(`SELECT COALESCE(SUM(gst_amount), 0) as value FROM sales WHERE date BETWEEN ? AND ? AND status = 'Completed'`).get(fromDate, toDate);

  const netProfit = profit.value - expenses.value;

  res.json({
    revenue: revenue.value,
    grossProfit: profit.value,
    expenses: expenses.value,
    netProfit,
    expenseByCategory,
    receivables: receivables.value,
    payables: payables.value,
    gstCollected: gstCollected.value,
    period: { from: fromDate, to: toDate },
  });
});

// GET /api/reports/payments
router.get('/payments', (req, res) => {
  const db = getDb();
  const { from, to, page = 1, limit = 50 } = req.query;
  const fromDate = from || new Date(new Date().setDate(1)).toISOString().split('T')[0];
  const toDate = to || new Date().toISOString().split('T')[0];
  const offset = (Number(page) - 1) * Number(limit);

  const payments = db.prepare(`
    SELECT p.*, c.name as customer_name, s.name as supplier_name
    FROM payments p
    LEFT JOIN customers c ON p.customer_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.date BETWEEN ? AND ?
    ORDER BY p.date DESC, p.id DESC LIMIT ? OFFSET ?
  `).all(fromDate, toDate, Number(limit), offset);

  const summary = db.prepare(`
    SELECT type, SUM(amount) as total FROM payments WHERE date BETWEEN ? AND ? GROUP BY type
  `).all(fromDate, toDate);

  res.json({ payments, summary });
});

// GET /api/reports/activity-logs
router.get('/activity', (req, res) => {
  const db = getDb();
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const logs = db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT ? OFFSET ?').all(Number(limit), offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM activity_logs').get();
  res.json({ logs, pagination: { total: total.count, page: Number(page), limit: Number(limit), pages: Math.ceil(total.count / Number(limit)) } });
});

module.exports = router;
