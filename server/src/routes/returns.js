const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate, logActivity } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// POST /api/returns/sales - Create sales return
router.post('/sales', (req, res, next) => {
  try {
    const db = getDb();
    const { original_sale_id, customer_id, date, items, total_amount, return_action, reason } = req.body;

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(original_sale_id);
    if (!sale) return res.status(404).json({ error: 'Original sale not found' });

    const count = db.prepare("SELECT COUNT(*) as count FROM returns WHERE type = 'Sales Return'").get();
    const returnNumber = `SR-${new Date().getFullYear()}-${String(count.count + 1).padStart(4, '0')}`;
    const returnDate = date || new Date().toISOString().split('T')[0];

    const createReturn = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO returns (return_number, type, original_sale_id, customer_id, date, total_amount, return_action, reason, status, created_by)
        VALUES (?, 'Sales Return', ?, ?, ?, ?, ?, ?, 'Completed', ?)
      `).run(returnNumber, original_sale_id, customer_id || sale.customer_id, returnDate, total_amount || 0, return_action || 'Refund', reason || null, req.user.id);

      const returnId = result.lastInsertRowid;

      items.forEach(item => {
        db.prepare(`INSERT INTO return_items (return_id, product_id, variant_id, product_name, size, color, quantity, rate, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(returnId, item.product_id, item.variant_id, item.product_name, item.size, item.color, item.quantity, item.rate, item.total_amount);

        if (item.variant_id) {
          const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(item.variant_id);
          const newStock = variant.stock + item.quantity;
          db.prepare('UPDATE product_variants SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, item.variant_id);
          db.prepare(`INSERT INTO stock_movements (product_id, variant_id, product_name, size, color, type, quantity, previous_stock, new_stock, reference_type, reference_id, reference_number, created_by) VALUES (?, ?, ?, ?, ?, 'Sales Return', ?, ?, ?, 'Return', ?, ?, ?)`)
            .run(item.product_id, item.variant_id, item.product_name, item.size, item.color, item.quantity, variant.stock, newStock, returnId, returnNumber, req.user.id);
        }
      });

      if (customer_id && return_action === 'Refund') {
        const prev = db.prepare('SELECT balance FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customer_id);
        const newBal = (prev?.balance || 0) - total_amount;
        db.prepare(`INSERT INTO customer_ledger (customer_id, date, type, description, reference_type, reference_id, reference_number, debit, credit, balance) VALUES (?, ?, 'Sales Return', ?, 'Return', ?, ?, 0, ?, ?)`)
          .run(customer_id, returnDate, `Return ${returnNumber}`, returnId, returnNumber, total_amount, newBal);
      }

      logActivity(req.user.id, req.user.name, 'Sales Return Created', 'Return', returnId, returnNumber, `₹${total_amount}`);
      return returnId;
    });

    const returnId = createReturn();
    res.status(201).json({ id: returnId, returnNumber, message: 'Sales return created successfully' });
  } catch (err) { next(err); }
});

// POST /api/returns/purchases - Create purchase return
router.post('/purchases', (req, res, next) => {
  try {
    const db = getDb();
    const { original_purchase_id, supplier_id, date, items, total_amount, reason } = req.body;
    const count = db.prepare("SELECT COUNT(*) as count FROM returns WHERE type = 'Purchase Return'").get();
    const returnNumber = `PR-${new Date().getFullYear()}-${String(count.count + 1).padStart(4, '0')}`;
    const returnDate = date || new Date().toISOString().split('T')[0];

    const createReturn = db.transaction(() => {
      const result = db.prepare(`INSERT INTO returns (return_number, type, original_purchase_id, supplier_id, date, total_amount, reason, status, created_by) VALUES (?, 'Purchase Return', ?, ?, ?, ?, ?, 'Completed', ?)`)
        .run(returnNumber, original_purchase_id || null, supplier_id || null, returnDate, total_amount || 0, reason || null, req.user.id);

      const returnId = result.lastInsertRowid;

      items.forEach(item => {
        db.prepare(`INSERT INTO return_items (return_id, product_id, variant_id, product_name, size, color, quantity, rate, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(returnId, item.product_id, item.variant_id, item.product_name, item.size, item.color, item.quantity, item.rate, item.total_amount);

        if (item.variant_id) {
          const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(item.variant_id);
          const newStock = Math.max(0, variant.stock - item.quantity);
          db.prepare('UPDATE product_variants SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, item.variant_id);
          db.prepare(`INSERT INTO stock_movements (product_id, variant_id, product_name, size, color, type, quantity, previous_stock, new_stock, reference_type, reference_id, reference_number, created_by) VALUES (?, ?, ?, ?, ?, 'Purchase Return', ?, ?, ?, 'Return', ?, ?, ?)`)
            .run(item.product_id, item.variant_id, item.product_name, item.size, item.color, -item.quantity, variant.stock, newStock, returnId, returnNumber, req.user.id);
        }
      });

      if (supplier_id) {
        const prev = db.prepare('SELECT balance FROM supplier_ledger WHERE supplier_id = ? ORDER BY id DESC LIMIT 1').get(supplier_id);
        const newBal = (prev?.balance || 0) - total_amount;
        db.prepare(`INSERT INTO supplier_ledger (supplier_id, date, type, description, reference_type, reference_id, reference_number, debit, credit, balance) VALUES (?, ?, 'Purchase Return', ?, 'Return', ?, ?, ?, 0, ?)`)
          .run(supplier_id, returnDate, `Return ${returnNumber}`, returnId, returnNumber, total_amount, newBal);
      }

      return returnId;
    });

    const returnId = createReturn();
    res.status(201).json({ id: returnId, returnNumber, message: 'Purchase return created successfully' });
  } catch (err) { next(err); }
});

// GET /api/returns
router.get('/', (req, res) => {
  const db = getDb();
  const { type, page = 1, limit = 20 } = req.query;
  let where = ['1=1']; const params = [];
  if (type) { where.push('r.type = ?'); params.push(type); }
  const offset = (Number(page) - 1) * Number(limit);
  const total = db.prepare(`SELECT COUNT(*) as count FROM returns r WHERE ${where.join(' AND ')}`).get(...params);
  const returns = db.prepare(`SELECT r.*, c.name as customer_name, s.name as supplier_name FROM returns r LEFT JOIN customers c ON r.customer_id = c.id LEFT JOIN suppliers s ON r.supplier_id = s.id WHERE ${where.join(' AND ')} ORDER BY r.id DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
  res.json({ returns, pagination: { total: total.count, page: Number(page), limit: Number(limit), pages: Math.ceil(total.count / Number(limit)) } });
});

// GET /api/returns/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const ret = db.prepare('SELECT r.*, c.name as customer_name, s.name as supplier_name FROM returns r LEFT JOIN customers c ON r.customer_id = c.id LEFT JOIN suppliers s ON r.supplier_id = s.id WHERE r.id = ?').get(req.params.id);
  if (!ret) return res.status(404).json({ error: 'Return not found' });
  const items = db.prepare('SELECT * FROM return_items WHERE return_id = ?').all(req.params.id);
  res.json({ ...ret, items });
});

module.exports = router;
