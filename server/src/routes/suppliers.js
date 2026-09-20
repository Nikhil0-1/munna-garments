const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate, logActivity } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/suppliers
router.get('/', (req, res) => {
  const db = getDb();
  const { search, page = 1, limit = 20 } = req.query;
  let where = ['s.active = 1']; const params = [];
  if (search) { where.push('(s.name LIKE ? OR s.company LIKE ? OR s.phone LIKE ?)'); const q = `%${search}%`; params.push(q, q, q); }
  const whereStr = `WHERE ${where.join(' AND ')}`;
  const offset = (Number(page) - 1) * Number(limit);
  const total = db.prepare(`SELECT COUNT(*) as count FROM suppliers s ${whereStr}`).get(...params);
  const suppliers = db.prepare(`
    SELECT s.*, COALESCE(SUM(p.total_amount), 0) as total_purchases, COALESCE(SUM(p.due_amount), 0) as payables
    FROM suppliers s LEFT JOIN purchases p ON p.supplier_id = s.id AND p.status = 'Completed'
    ${whereStr} GROUP BY s.id ORDER BY s.name ASC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);
  res.json({ suppliers, pagination: { total: total.count, page: Number(page), limit: Number(limit), pages: Math.ceil(total.count / Number(limit)) } });
});

// GET /api/suppliers/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  const purchases = db.prepare('SELECT * FROM purchases WHERE supplier_id = ? ORDER BY id DESC LIMIT 20').all(req.params.id);
  const ledger = db.prepare('SELECT * FROM supplier_ledger WHERE supplier_id = ? ORDER BY id DESC LIMIT 50').all(req.params.id);
  const stats = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total, COALESCE(SUM(paid_amount), 0) as paid, COALESCE(SUM(due_amount), 0) as due FROM purchases WHERE supplier_id = ?').get(req.params.id);
  res.json({ ...supplier, purchases, ledger, stats });
});

// POST /api/suppliers
router.post('/', (req, res, next) => {
  try {
    const db = getDb();
    const { name, company, phone, email, address, city, state, pincode, gstin, opening_balance } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = db.prepare('INSERT INTO suppliers (name, company, phone, email, address, city, state, pincode, gstin, opening_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(name, company || null, phone || null, email || null, address || null, city || null, state || null, pincode || null, gstin || null, opening_balance || 0);
    logActivity(req.user.id, req.user.name, 'Supplier Created', 'Supplier', result.lastInsertRowid, null, name);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Supplier created' });
  } catch (err) { next(err); }
});

// PUT /api/suppliers/:id
router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const { name, company, phone, email, address, city, state, pincode, gstin } = req.body;
    db.prepare('UPDATE suppliers SET name=?, company=?, phone=?, email=?, address=?, city=?, state=?, pincode=?, gstin=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(name, company || null, phone || null, email || null, address || null, city || null, state || null, pincode || null, gstin || null, req.params.id);
    res.json({ message: 'Supplier updated' });
  } catch (err) { next(err); }
});

// DELETE /api/suppliers/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE suppliers SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    res.json({ message: 'Supplier deleted' });
  } catch (err) { next(err); }
});

// POST /api/suppliers/:id/payment
router.post('/:id/payment', (req, res, next) => {
  try {
    const db = getDb();
    const { amount, payment_method, notes, date } = req.body;
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    const payDate = date || new Date().toISOString().split('T')[0];
    const prevBalance = db.prepare('SELECT balance FROM supplier_ledger WHERE supplier_id = ? ORDER BY id DESC LIMIT 1').get(req.params.id);
    const newBalance = (prevBalance?.balance || 0) - Number(amount);
    db.prepare('INSERT INTO supplier_ledger (supplier_id, date, type, description, debit, credit, balance) VALUES (?, ?, \'Payment Made\', ?, ?, 0, ?)')
      .run(req.params.id, payDate, notes || 'Payment made', Number(amount), newBalance);
    db.prepare('INSERT INTO payments (type, party_type, supplier_id, amount, payment_method, date, notes, created_by) VALUES (\'Paid\', \'Supplier\', ?, ?, ?, ?, ?, ?)')
      .run(req.params.id, Number(amount), payment_method || 'Cash', payDate, notes || null, req.user.id);
    res.json({ message: 'Payment recorded', balance: newBalance });
  } catch (err) { next(err); }
});

module.exports = router;
