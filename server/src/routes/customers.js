const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate, logActivity } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/customers
router.get('/', (req, res) => {
  const db = getDb();
  const { search, page = 1, limit = 20 } = req.query;

  let where = ['c.active = 1'];
  const params = [];
  if (search) { where.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)'); const q = `%${search}%`; params.push(q, q, q); }

  const whereStr = `WHERE ${where.join(' AND ')}`;
  const offset = (Number(page) - 1) * Number(limit);

  const total = db.prepare(`SELECT COUNT(*) as count FROM customers c ${whereStr}`).get(...params);
  const customers = db.prepare(`
    SELECT c.*,
      COALESCE(SUM(s.total_amount), 0) as total_purchases,
      COALESCE(SUM(s.paid_amount), 0) as total_paid,
      COALESCE(SUM(s.due_amount), 0) as outstanding,
      COUNT(DISTINCT s.id) as invoice_count,
      MAX(s.date) as last_purchase
    FROM customers c
    LEFT JOIN sales s ON s.customer_id = c.id AND s.status = 'Completed'
    ${whereStr}
    GROUP BY c.id
    ORDER BY c.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({ customers, pagination: { total: total.count, page: Number(page), limit: Number(limit), pages: Math.ceil(total.count / Number(limit)) } });
});

// GET /api/customers/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const sales = db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY id DESC LIMIT 20').all(req.params.id);
  const ledger = db.prepare('SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 50').all(req.params.id);

  const stats = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total_purchases,
      COALESCE(SUM(paid_amount), 0) as total_paid,
      COALESCE(SUM(due_amount), 0) as outstanding,
      COUNT(*) as invoice_count
    FROM sales WHERE customer_id = ? AND status = 'Completed'
  `).get(req.params.id);

  res.json({ ...customer, sales, ledger, stats });
});

// POST /api/customers
router.post('/', (req, res, next) => {
  try {
    const db = getDb();
    const { name, phone, email, address, city, state, pincode, gstin, opening_balance } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = db.prepare(`
      INSERT INTO customers (name, phone, email, address, city, state, pincode, gstin, opening_balance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, phone || null, email || null, address || null, city || null, state || null, pincode || null, gstin || null, opening_balance || 0);

    if (opening_balance && Number(opening_balance) > 0) {
      db.prepare(`INSERT INTO customer_ledger (customer_id, date, type, description, debit, credit, balance) VALUES (?, ?, 'Opening Balance', 'Opening Balance', ?, 0, ?)`)
        .run(result.lastInsertRowid, new Date().toISOString().split('T')[0], Number(opening_balance), Number(opening_balance));
    }

    logActivity(req.user.id, req.user.name, 'Customer Created', 'Customer', result.lastInsertRowid, null, name);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Customer created' });
  } catch (err) { next(err); }
});

// PUT /api/customers/:id
router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const { name, phone, email, address, city, state, pincode, gstin } = req.body;
    db.prepare(`UPDATE customers SET name=?, phone=?, email=?, address=?, city=?, state=?, pincode=?, gstin=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(name, phone || null, email || null, address || null, city || null, state || null, pincode || null, gstin || null, req.params.id);
    res.json({ message: 'Customer updated' });
  } catch (err) { next(err); }
});

// DELETE /api/customers/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE customers SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    res.json({ message: 'Customer deleted' });
  } catch (err) { next(err); }
});

// POST /api/customers/:id/payment
router.post('/:id/payment', (req, res, next) => {
  try {
    const db = getDb();
    const { amount, payment_method, notes, date } = req.body;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const payDate = date || new Date().toISOString().split('T')[0];
    const prevBalance = db.prepare('SELECT balance FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(req.params.id);
    const newBalance = (prevBalance?.balance || 0) - Number(amount);

    db.prepare(`INSERT INTO customer_ledger (customer_id, date, type, description, debit, credit, balance) VALUES (?, ?, 'Payment Received', ?, 0, ?, ?)`)
      .run(req.params.id, payDate, notes || 'Payment received', Number(amount), newBalance);

    db.prepare(`INSERT INTO payments (type, party_type, customer_id, amount, payment_method, date, notes, created_by) VALUES ('Received', 'Customer', ?, ?, ?, ?, ?, ?)`)
      .run(req.params.id, Number(amount), payment_method || 'Cash', payDate, notes || null, req.user.id);

    res.json({ message: 'Payment recorded', balance: newBalance });
  } catch (err) { next(err); }
});

module.exports = router;
