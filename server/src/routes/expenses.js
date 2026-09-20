const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate, logActivity } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/expenses
router.get('/', (req, res) => {
  const db = getDb();
  const { from, to, category, page = 1, limit = 20 } = req.query;

  let where = ['1=1']; const params = [];
  if (from) { where.push('date >= ?'); params.push(from); }
  if (to) { where.push('date <= ?'); params.push(to); }
  if (category) { where.push('category = ?'); params.push(category); }

  const whereStr = `WHERE ${where.join(' AND ')}`;
  const offset = (Number(page) - 1) * Number(limit);
  const total = db.prepare(`SELECT COUNT(*) as count FROM expenses ${whereStr}`).get(...params);
  const summary = db.prepare(`SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses ${whereStr} GROUP BY category ORDER BY total DESC`).all(...params);
  const expenses = db.prepare(`SELECT * FROM expenses ${whereStr} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
  const grandTotal = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses ${whereStr}`).get(...params);

  res.json({ expenses, summary, grandTotal: grandTotal.total, pagination: { total: total.count, page: Number(page), limit: Number(limit), pages: Math.ceil(total.count / Number(limit)) } });
});

// POST /api/expenses
router.post('/', (req, res, next) => {
  try {
    const db = getDb();
    const { category, amount, date, payment_method, description } = req.body;
    if (!category || !amount) return res.status(400).json({ error: 'Category and amount required' });

    const result = db.prepare('INSERT INTO expenses (category, amount, date, payment_method, description, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(category, Number(amount), date || new Date().toISOString().split('T')[0], payment_method || 'Cash', description || null, req.user.id);

    logActivity(req.user.id, req.user.name, 'Expense Added', 'Expense', result.lastInsertRowid, null, `${category}: ₹${amount}`);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Expense recorded' });
  } catch (err) { next(err); }
});

// PUT /api/expenses/:id
router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const { category, amount, date, payment_method, description } = req.body;
    db.prepare('UPDATE expenses SET category=?, amount=?, date=?, payment_method=?, description=? WHERE id=?')
      .run(category, Number(amount), date, payment_method || 'Cash', description || null, req.params.id);
    res.json({ message: 'Expense updated' });
  } catch (err) { next(err); }
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (err) { next(err); }
});

// GET /api/expenses/categories
router.get('/categories/list', (req, res) => {
  res.json(['Rent', 'Electricity', 'Salary', 'Transport', 'Packaging', 'Marketing', 'Maintenance', 'Other']);
});

module.exports = router;
