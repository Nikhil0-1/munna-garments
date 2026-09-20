const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate, logActivity } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/sales - List invoices
router.get('/', (req, res) => {
  const db = getDb();
  const { search, from, to, customer_id, payment_method, status, page = 1, limit = 20 } = req.query;

  let where = ['1=1'];
  const params = [];

  if (search) {
    where.push('(s.invoice_number LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (from) { where.push('s.date >= ?'); params.push(from); }
  if (to) { where.push('s.date <= ?'); params.push(to); }
  if (customer_id) { where.push('s.customer_id = ?'); params.push(customer_id); }
  if (payment_method) { where.push('s.payment_method = ?'); params.push(payment_method); }
  if (status) { where.push('s.status = ?'); params.push(status); }

  const whereStr = `WHERE ${where.join(' AND ')}`;
  const offset = (Number(page) - 1) * Number(limit);

  const total = db.prepare(`SELECT COUNT(*) as count FROM sales s ${whereStr}`).get(...params);
  const sales = db.prepare(`
    SELECT s.*, 
      (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
    FROM sales s
    ${whereStr}
    ORDER BY s.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({
    sales,
    pagination: { total: total.count, page: Number(page), limit: Number(limit), pages: Math.ceil(total.count / Number(limit)) },
  });
});

// GET /api/sales/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id').all(sale.id);
  const customer = sale.customer_id ? db.prepare('SELECT * FROM customers WHERE id = ?').get(sale.customer_id) : null;

  // Shop settings for invoice
  const settings = db.prepare('SELECT key, value FROM shop_settings').all();
  const shopSettings = {};
  settings.forEach(s => { shopSettings[s.key] = s.value; });

  res.json({ ...sale, items, customer, shopSettings });
});

// POST /api/sales - Create sale (POS)
router.post('/', (req, res, next) => {
  try {
    const db = getDb();
    const {
      customer_id, customer_name, customer_phone,
      items, subtotal, discount_amount, gst_amount, cgst_amount, sgst_amount, igst_amount,
      round_off, total_amount, paid_amount, due_amount,
      payment_method, payment_method_2, paid_amount_2, notes
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'At least one item required' });
    }

    // Generate invoice number
    const settings = db.prepare("SELECT value FROM shop_settings WHERE key = 'invoice_counter'").get();
    const yearSetting = db.prepare("SELECT value FROM shop_settings WHERE key = 'invoice_year'").get();
    const prefixSetting = db.prepare("SELECT value FROM shop_settings WHERE key = 'invoice_prefix'").get();
    
    const currentYear = new Date().getFullYear().toString();
    let counter = parseInt(settings?.value || '0') + 1;

    // Reset counter if year changed
    if (yearSetting?.value !== currentYear) {
      counter = 1;
      db.prepare("UPDATE shop_settings SET value = ? WHERE key = 'invoice_year'").run(currentYear);
    }

    const prefix = prefixSetting?.value || 'MRG';
    const invoiceNumber = `${prefix}-${currentYear}-${String(counter).padStart(4, '0')}`;
    db.prepare("UPDATE shop_settings SET value = ? WHERE key = 'invoice_counter'").run(String(counter));

    const today = new Date().toISOString().split('T')[0];

    // Validate stock
    for (const item of items) {
      if (item.variant_id) {
        const variant = db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(item.variant_id);
        if (!variant || variant.stock < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${item.product_name} (${item.size}/${item.color}). Available: ${variant?.stock || 0}`
          });
        }
      }
    }

    // Create sale in transaction
    const createSale = db.transaction(() => {
      const saleResult = db.prepare(`
        INSERT INTO sales (invoice_number, customer_id, customer_name, customer_phone, date,
          subtotal, discount_amount, gst_amount, cgst_amount, sgst_amount, igst_amount,
          round_off, total_amount, paid_amount, due_amount, payment_method, payment_method_2,
          paid_amount_2, status, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?, ?)
      `).run(invoiceNumber, customer_id || null, customer_name || 'Walk-in Customer',
        customer_phone || null, today, subtotal || 0, discount_amount || 0,
        gst_amount || 0, cgst_amount || 0, sgst_amount || 0, igst_amount || 0,
        round_off || 0, total_amount, paid_amount || 0, due_amount || 0,
        payment_method || 'Cash', payment_method_2 || null, paid_amount_2 || 0,
        notes || null, req.user.id);

      const saleId = saleResult.lastInsertRowid;

      // Insert items, update stock, create movements
      items.forEach(item => {
        const profit = (item.total_amount || 0) - ((item.purchase_price || 0) * item.quantity);

        db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, variant_id, product_name, size, color,
            quantity, mrp, selling_price, purchase_price, discount_percent, discount_amount,
            gst_rate, gst_amount, cgst_amount, sgst_amount, total_amount, profit)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(saleId, item.product_id || null, item.variant_id || null, item.product_name,
          item.size || null, item.color || null, item.quantity, item.mrp || 0,
          item.selling_price || 0, item.purchase_price || 0, item.discount_percent || 0,
          item.discount_amount || 0, item.gst_rate || 0, item.gst_amount || 0,
          (item.gst_amount || 0) / 2, (item.gst_amount || 0) / 2,
          item.total_amount || 0, profit);

        // Update stock
        if (item.variant_id) {
          const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(item.variant_id);
          const prevStock = variant.stock;
          const newStock = prevStock - item.quantity;
          db.prepare('UPDATE product_variants SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, item.variant_id);

          db.prepare(`
            INSERT INTO stock_movements (product_id, variant_id, product_name, size, color, type,
              quantity, previous_stock, new_stock, reference_type, reference_id, reference_number, created_by)
            VALUES (?, ?, ?, ?, ?, 'Sale', ?, ?, ?, 'Sale', ?, ?, ?)
          `).run(item.product_id, item.variant_id, item.product_name, item.size, item.color,
            -item.quantity, prevStock, newStock, saleId, invoiceNumber, req.user.id);
        }
      });

      // Customer ledger
      if (customer_id) {
        const prevBalance = db.prepare('SELECT balance FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customer_id);
        const prevBal = prevBalance?.balance || 0;
        const newBalance = prevBal + total_amount - (paid_amount || 0);
        
        db.prepare(`
          INSERT INTO customer_ledger (customer_id, date, type, description, reference_type, reference_id, reference_number, debit, credit, balance)
          VALUES (?, ?, 'Sale', ?, 'Sale', ?, ?, ?, ?, ?)
        `).run(customer_id, today, `Invoice ${invoiceNumber}`, saleId, invoiceNumber, total_amount, paid_amount || 0, newBalance);
      }

      logActivity(req.user.id, req.user.name, 'Sale Created', 'Sale', saleId, invoiceNumber, `₹${total_amount}`);
      return saleId;
    });

    const saleId = createSale();
    const fullSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);

    res.status(201).json({ id: saleId, invoiceNumber, sale: fullSale, items: saleItems });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/sales/:id/payment - Add payment to credit sale
router.patch('/:id/payment', (req, res, next) => {
  try {
    const db = getDb();
    const { amount, payment_method } = req.body;
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    const newPaid = sale.paid_amount + Number(amount);
    const newDue = Math.max(0, sale.total_amount - newPaid);

    db.prepare('UPDATE sales SET paid_amount = ?, due_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newPaid, newDue, req.params.id);

    if (sale.customer_id) {
      const prevBalance = db.prepare('SELECT balance FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(sale.customer_id);
      const newBalance = (prevBalance?.balance || 0) - Number(amount);
      db.prepare(`
        INSERT INTO customer_ledger (customer_id, date, type, description, reference_type, reference_id, reference_number, debit, credit, balance)
        VALUES (?, ?, 'Payment', ?, 'Sale', ?, ?, ?, ?, ?)
      `).run(sale.customer_id, new Date().toISOString().split('T')[0], `Payment for ${sale.invoice_number}`, sale.id, sale.invoice_number, 0, Number(amount), newBalance);
    }

    logActivity(req.user.id, req.user.name, 'Payment Added', 'Sale', req.params.id, sale.invoice_number, `₹${amount}`);
    res.json({ message: 'Payment recorded', paidAmount: newPaid, dueAmount: newDue });
  } catch (err) { next(err); }
});

// DELETE /api/sales/:id - Cancel sale
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (sale.status === 'Cancelled') return res.status(400).json({ error: 'Sale already cancelled' });

    const cancel = db.transaction(() => {
      db.prepare("UPDATE sales SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
      
      const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
      items.forEach(item => {
        if (item.variant_id) {
          const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(item.variant_id);
          const newStock = variant.stock + item.quantity;
          db.prepare('UPDATE product_variants SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, item.variant_id);
          db.prepare(`
            INSERT INTO stock_movements (product_id, variant_id, product_name, size, color, type, quantity, previous_stock, new_stock, reference_type, reference_id, reference_number, created_by)
            VALUES (?, ?, ?, ?, ?, 'Sales Return', ?, ?, ?, 'Sale', ?, ?, ?)
          `).run(item.product_id, item.variant_id, item.product_name, item.size, item.color, item.quantity, variant.stock, newStock, req.params.id, sale.invoice_number, req.user.id);
        }
      });
    });

    cancel();
    logActivity(req.user.id, req.user.name, 'Sale Cancelled', 'Sale', req.params.id, sale.invoice_number, null);
    res.json({ message: 'Sale cancelled successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
