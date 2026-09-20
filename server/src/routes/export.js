const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const { getDb, dataDir } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function buildWorkbook(sheets) {
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, data]) => {
    if (data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(data);
      // Auto-width columns
      const colWidths = Object.keys(data[0]).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length))
      }));
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
    }
  });
  return wb;
}

// GET /api/export/sales
router.get('/sales', (req, res) => {
  const db = getDb();
  const { from, to } = req.query;
  const fromDate = from || '2000-01-01';
  const toDate = to || new Date().toISOString().split('T')[0];

  const sales = db.prepare(`
    SELECT s.invoice_number as "Invoice #", s.date as "Date", s.customer_name as "Customer",
      s.customer_phone as "Phone", s.subtotal as "Subtotal", s.discount_amount as "Discount",
      s.gst_amount as "GST", s.total_amount as "Total", s.paid_amount as "Paid",
      s.due_amount as "Due", s.payment_method as "Payment Method", s.status as "Status"
    FROM sales s WHERE s.date BETWEEN ? AND ? AND s.status = 'Completed' ORDER BY s.date DESC
  `).all(fromDate, toDate);

  const saleItems = db.prepare(`
    SELECT s.invoice_number as "Invoice #", s.date as "Date", si.product_name as "Product",
      si.size as "Size", si.color as "Color", si.quantity as "Qty", si.selling_price as "Rate",
      si.discount_amount as "Discount", si.gst_amount as "GST", si.total_amount as "Total",
      si.profit as "Profit"
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE s.date BETWEEN ? AND ? AND s.status = 'Completed' ORDER BY s.date DESC
  `).all(fromDate, toDate);

  const wb = buildWorkbook({ 'Sales Summary': sales, 'Sale Items': saleItems });
  const filename = `Sales_${fromDate}_to_${toDate}.xlsx`;
  const filepath = path.join(dataDir, 'Excel', filename);
  XLSX.writeFile(wb, filepath);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  res.send(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
});

// GET /api/export/products
router.get('/products', (req, res) => {
  const db = getDb();
  const products = db.prepare(`
    SELECT p.name as "Product Name", p.sku as "SKU", p.barcode as "Barcode",
      c.name as "Category", p.brand as "Brand", p.fabric as "Fabric", p.gender as "Gender",
      p.gst_rate as "GST %", p.mrp as "MRP", p.purchase_price as "Purchase Price",
      p.selling_price as "Selling Price", p.min_stock as "Min Stock",
      COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = p.id), 0) as "Current Stock"
    FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.active = 1 ORDER BY p.name
  `).all();

  const variants = db.prepare(`
    SELECT p.name as "Product", p.sku as "Product SKU", pv.size as "Size", pv.color as "Color",
      pv.variant_sku as "Variant SKU", pv.stock as "Stock", pv.purchase_price as "Purchase Price",
      pv.selling_price as "Selling Price"
    FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE p.active = 1 ORDER BY p.name, pv.size, pv.color
  `).all();

  const wb = buildWorkbook({ 'Products': products, 'Variants': variants });
  const filename = `Products_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
});

// GET /api/export/customers
router.get('/customers', (req, res) => {
  const db = getDb();
  const customers = db.prepare(`
    SELECT c.name as "Name", c.phone as "Phone", c.email as "Email", c.address as "Address",
      c.city as "City", c.state as "State", c.gstin as "GSTIN",
      COALESCE(SUM(s.total_amount), 0) as "Total Purchases",
      COALESCE(SUM(s.paid_amount), 0) as "Total Paid",
      COALESCE(SUM(s.due_amount), 0) as "Outstanding"
    FROM customers c LEFT JOIN sales s ON s.customer_id = c.id AND s.status = 'Completed'
    WHERE c.active = 1 GROUP BY c.id ORDER BY c.name
  `).all();

  const wb = buildWorkbook({ 'Customers': customers });
  const filename = `Customers_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
});

// GET /api/export/stock
router.get('/stock', (req, res) => {
  const db = getDb();
  const stock = db.prepare(`
    SELECT p.name as "Product", p.sku as "SKU", pv.size as "Size", pv.color as "Color",
      pv.stock as "Stock", COALESCE(pv.purchase_price, p.purchase_price) as "Purchase Price",
      COALESCE(pv.selling_price, p.selling_price) as "Selling Price",
      pv.stock * COALESCE(pv.selling_price, p.selling_price) as "Stock Value"
    FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE p.active = 1 ORDER BY p.name, pv.size
  `).all();

  const movements = db.prepare(`
    SELECT sm.created_at as "Date", sm.product_name as "Product", sm.size as "Size",
      sm.color as "Color", sm.type as "Type", sm.quantity as "Qty",
      sm.previous_stock as "Prev Stock", sm.new_stock as "New Stock",
      sm.reference_number as "Reference", sm.reason as "Reason"
    FROM stock_movements sm ORDER BY sm.created_at DESC LIMIT 1000
  `).all();

  const wb = buildWorkbook({ 'Current Stock': stock, 'Stock Movements': movements });
  const filename = `Stock_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
});

// GET /api/export/expenses
router.get('/expenses', (req, res) => {
  const db = getDb();
  const { from, to } = req.query;
  const fromDate = from || '2000-01-01';
  const toDate = to || new Date().toISOString().split('T')[0];

  const expenses = db.prepare(`
    SELECT date as "Date", category as "Category", amount as "Amount",
      payment_method as "Payment Method", description as "Description"
    FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC
  `).all(fromDate, toDate);

  const summary = db.prepare(`
    SELECT category as "Category", COUNT(*) as "Count", SUM(amount) as "Total Amount"
    FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY "Total Amount" DESC
  `).all(fromDate, toDate);

  const wb = buildWorkbook({ 'Expenses': expenses, 'Category Summary': summary });
  const filename = `Expenses_${fromDate}_to_${toDate}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
});

// GET /api/export/all
router.get('/all', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const sales = db.prepare("SELECT invoice_number as 'Invoice', date as 'Date', customer_name as 'Customer', total_amount as 'Total', paid_amount as 'Paid', due_amount as 'Due', payment_method as 'Method', status as 'Status' FROM sales ORDER BY date DESC").all();
  const products = db.prepare("SELECT p.name as 'Product', p.sku as 'SKU', c.name as 'Category', p.selling_price as 'Price', COALESCE(SUM(pv.stock), 0) as 'Stock' FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN product_variants pv ON pv.product_id = p.id WHERE p.active = 1 GROUP BY p.id ORDER BY p.name").all();
  const customers = db.prepare("SELECT name as 'Name', phone as 'Phone', email as 'Email', city as 'City' FROM customers WHERE active = 1 ORDER BY name").all();
  const expenses = db.prepare("SELECT date as 'Date', category as 'Category', amount as 'Amount', payment_method as 'Method' FROM expenses ORDER BY date DESC").all();

  const wb = buildWorkbook({ 'Sales': sales, 'Products': products, 'Customers': customers, 'Expenses': expenses });
  const filename = `Complete_Export_${today}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
});

module.exports = router;
