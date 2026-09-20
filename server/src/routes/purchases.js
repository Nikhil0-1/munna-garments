const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate, logActivity } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/purchases
router.get('/', (req, res) => {
  const db = getDb();
  const { search, from, to, supplier_id, page = 1, limit = 20 } = req.query;

  let where = ['1=1'];
  const params = [];

  if (search) { where.push('(p.purchase_number LIKE ? OR p.supplier_invoice LIKE ?)'); const q = `%${search}%`; params.push(q, q); }
  if (from) { where.push('p.date >= ?'); params.push(from); }
  if (to) { where.push('p.date <= ?'); params.push(to); }
  if (supplier_id) { where.push('p.supplier_id = ?'); params.push(supplier_id); }

  const whereStr = `WHERE ${where.join(' AND ')}`;
  const offset = (Number(page) - 1) * Number(limit);

  const total = db.prepare(`SELECT COUNT(*) as count FROM purchases p ${whereStr}`).get(...params);
  const purchases = db.prepare(`
    SELECT p.*, s.name as supplier_name,
      (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as item_count
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    ${whereStr}
    ORDER BY p.id DESC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({ purchases, pagination: { total: total.count, page: Number(page), limit: Number(limit), pages: Math.ceil(total.count / Number(limit)) } });
});

// GET /api/purchases/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const purchase = db.prepare(`
    SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.gstin as supplier_gstin
    FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?
  `).get(req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

  const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id').all(purchase.id);
  res.json({ ...purchase, items });
});

// POST /api/purchases - Create purchase
router.post('/', (req, res, next) => {
  try {
    const db = getDb();
    const { supplier_id, supplier_invoice, date, items, subtotal, discount_amount, gst_amount, total_amount, paid_amount, payment_method, notes } = req.body;

    if (!items || !items.length) return res.status(400).json({ error: 'At least one item required' });

    // Generate purchase number
    const count = db.prepare('SELECT COUNT(*) as count FROM purchases').get();
    const purchaseNumber = `PUR-${new Date().getFullYear()}-${String(count.count + 1).padStart(4, '0')}`;
    const due = (total_amount || 0) - (paid_amount || 0);

    const createPurchase = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO purchases (purchase_number, supplier_id, supplier_invoice, date, subtotal, discount_amount, gst_amount, total_amount, paid_amount, due_amount, payment_method, status, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?, ?)
      `).run(purchaseNumber, supplier_id || null, supplier_invoice || null, date || new Date().toISOString().split('T')[0],
        subtotal || 0, discount_amount || 0, gst_amount || 0, total_amount || 0, paid_amount || 0, due, payment_method || 'Cash', notes || null, req.user.id);

      const purchaseId = result.lastInsertRowid;

      items.forEach(item => {
        db.prepare(`
          INSERT INTO purchase_items (purchase_id, product_id, variant_id, product_name, size, color, quantity, unit, purchase_rate, discount_percent, discount_amount, gst_rate, gst_amount, total_amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(purchaseId, item.product_id || null, item.variant_id || null, item.product_name,
          item.size || null, item.color || null, item.quantity, item.unit || 'Piece',
          item.purchase_rate || 0, item.discount_percent || 0, item.discount_amount || 0,
          item.gst_rate || 0, item.gst_amount || 0, item.total_amount || 0);

        // Update stock
        if (item.variant_id) {
          const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(item.variant_id);
          if (variant) {
            const prevStock = variant.stock;
            const newStock = prevStock + item.quantity;
            db.prepare('UPDATE product_variants SET stock = ?, purchase_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(newStock, item.purchase_rate || variant.purchase_price, item.variant_id);

            db.prepare(`
              INSERT INTO stock_movements (product_id, variant_id, product_name, size, color, type, quantity, previous_stock, new_stock, reference_type, reference_id, reference_number, created_by)
              VALUES (?, ?, ?, ?, ?, 'Purchase', ?, ?, ?, 'Purchase', ?, ?, ?)
            `).run(item.product_id, item.variant_id, item.product_name, item.size, item.color,
              item.quantity, prevStock, newStock, purchaseId, purchaseNumber, req.user.id);
          }
        }
      });

      // Supplier ledger
      if (supplier_id) {
        const prevBalance = db.prepare('SELECT balance FROM supplier_ledger WHERE supplier_id = ? ORDER BY id DESC LIMIT 1').get(supplier_id);
        const newBalance = (prevBalance?.balance || 0) + total_amount - (paid_amount || 0);
        db.prepare(`
          INSERT INTO supplier_ledger (supplier_id, date, type, description, reference_type, reference_id, reference_number, debit, credit, balance)
          VALUES (?, ?, 'Purchase', ?, 'Purchase', ?, ?, ?, ?, ?)
        `).run(supplier_id, date || new Date().toISOString().split('T')[0], `Purchase ${purchaseNumber}`, purchaseId, purchaseNumber, 0, total_amount, newBalance);
      }

      logActivity(req.user.id, req.user.name, 'Purchase Created', 'Purchase', purchaseId, purchaseNumber, `₹${total_amount}`);
      return purchaseId;
    });

    const purchaseId = createPurchase();
    res.status(201).json({ id: purchaseId, purchaseNumber, message: 'Purchase created successfully' });
  } catch (err) { next(err); }
});

// PATCH /api/purchases/:id/payment
router.patch('/:id/payment', (req, res, next) => {
  try {
    const db = getDb();
    const { amount, payment_method } = req.body;
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

    const newPaid = purchase.paid_amount + Number(amount);
    const newDue = Math.max(0, purchase.total_amount - newPaid);
    db.prepare('UPDATE purchases SET paid_amount = ?, due_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newPaid, newDue, req.params.id);

    if (purchase.supplier_id) {
      const prevBalance = db.prepare('SELECT balance FROM supplier_ledger WHERE supplier_id = ? ORDER BY id DESC LIMIT 1').get(purchase.supplier_id);
      const newBalance = (prevBalance?.balance || 0) - Number(amount);
      db.prepare(`
        INSERT INTO supplier_ledger (supplier_id, date, type, description, reference_type, reference_id, reference_number, debit, credit, balance)
        VALUES (?, ?, 'Payment', ?, 'Purchase', ?, ?, ?, ?, ?)
      `).run(purchase.supplier_id, new Date().toISOString().split('T')[0], `Payment for ${purchase.purchase_number}`, req.params.id, purchase.purchase_number, Number(amount), 0, newBalance);
    }

    res.json({ message: 'Payment recorded', paidAmount: newPaid, dueAmount: newDue });
  } catch (err) { next(err); }
});

module.exports = router;
