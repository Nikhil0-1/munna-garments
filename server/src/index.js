require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const { initializeSchema, dataDir } = require('./db/schema');
const { seedDatabase } = require('./db/seed');
const { errorHandler } = require('./middleware/auth');

// Routes
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const productsRoutes = require('./routes/products');
const categoriesRoutes = require('./routes/categories');
const salesRoutes = require('./routes/sales');
const purchasesRoutes = require('./routes/purchases');
const customersRoutes = require('./routes/customers');
const suppliersRoutes = require('./routes/suppliers');
const expensesRoutes = require('./routes/expenses');
const returnsRoutes = require('./routes/returns');
const reportsRoutes = require('./routes/reports');
const exportRoutes = require('./routes/export');
const backupRoutes = require('./routes/backup');
const catalogueRoutes = require('./routes/catalogue');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded product images
const uploadsDir = path.join(dataDir, 'Product Images');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads/products', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/catalogue', catalogueRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', shop: 'Munna Readymade Garments', location: 'Dhobwal Bazzar', timestamp: new Date().toISOString() });
});

// Users management (basic)
app.get('/api/users', require('./middleware/auth').authenticate, (req, res) => {
  const { getDb } = require('./db/schema');
  const db = getDb();
  const users = db.prepare('SELECT u.id, u.name, u.username, u.active, r.name as role FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY u.name').all();
  res.json(users);
});

app.post('/api/users', require('./middleware/auth').authenticate, (req, res) => {
  const { getDb } = require('./db/schema');
  const db = getDb();
  const bcrypt = require('bcryptjs');
  const { name, username, password, role_id } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'Name, username, and password required' });
  const hashed = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (name, username, password, role_id) VALUES (?, ?, ?, ?)').run(name, username, hashed, role_id || 1);
    res.status(201).json({ id: result.lastInsertRowid, message: 'User created' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/roles', require('./middleware/auth').authenticate, (req, res) => {
  const { getDb } = require('./db/schema');
  const db = getDb();
  res.json(db.prepare('SELECT * FROM roles').all());
});

// Global search
app.get('/api/search', require('./middleware/auth').authenticate, (req, res) => {
  const { getDb } = require('./db/schema');
  const db = getDb();
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ products: [], sales: [], customers: [], suppliers: [] });

  const s = `%${q}%`;
  const products = db.prepare("SELECT id, name, sku, selling_price FROM products WHERE active = 1 AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?) LIMIT 5").all(s, s, s);
  const sales = db.prepare("SELECT id, invoice_number, customer_name, total_amount, date FROM sales WHERE invoice_number LIKE ? OR customer_name LIKE ? ORDER BY id DESC LIMIT 5").all(s, s);
  const customers = db.prepare("SELECT id, name, phone FROM customers WHERE active = 1 AND (name LIKE ? OR phone LIKE ?) LIMIT 5").all(s, s);
  const suppliers = db.prepare("SELECT id, name, phone FROM suppliers WHERE active = 1 AND (name LIKE ? OR phone LIKE ?) LIMIT 5").all(s, s);

  res.json({ products, sales, customers, suppliers });
});

// Stock entry endpoint
app.post('/api/stock/entry', require('./middleware/auth').authenticate, (req, res) => {
  const { getDb } = require('./db/schema');
  const { logActivity } = require('./middleware/auth');
  const db = getDb();
  const { product_id, variant_id, quantity, reason, notes } = req.body;

  const variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(variant_id, product_id);
  if (!variant) return res.status(404).json({ error: 'Variant not found' });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  const prevStock = variant.stock;
  const newStock = prevStock + Number(quantity);

  db.prepare('UPDATE product_variants SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, variant_id);
  db.prepare(`INSERT INTO stock_movements (product_id, variant_id, product_name, size, color, type, quantity, previous_stock, new_stock, reason, notes, created_by) VALUES (?, ?, ?, ?, ?, 'Stock Entry', ?, ?, ?, ?, ?, ?)`)
    .run(product_id, variant_id, product.name, variant.size, variant.color, quantity, prevStock, newStock, reason || 'Stock Entry', notes || null, req.user.id);

  logActivity(req.user.id, req.user.name, 'Stock Entry', 'Product', product_id, product.sku, `${product.name}: +${quantity}`);
  res.json({ message: 'Stock updated', previousStock: prevStock, newStock });
});

// Stock exit endpoint
app.post('/api/stock/exit', require('./middleware/auth').authenticate, (req, res) => {
  const { getDb } = require('./db/schema');
  const { logActivity } = require('./middleware/auth');
  const db = getDb();
  const { product_id, variant_id, quantity, reason, notes } = req.body;

  const variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(variant_id, product_id);
  if (!variant) return res.status(404).json({ error: 'Variant not found' });
  if (variant.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  const prevStock = variant.stock;
  const newStock = prevStock - Number(quantity);

  db.prepare('UPDATE product_variants SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, variant_id);
  db.prepare(`INSERT INTO stock_movements (product_id, variant_id, product_name, size, color, type, quantity, previous_stock, new_stock, reason, notes, created_by) VALUES (?, ?, ?, ?, ?, 'Stock Exit', ?, ?, ?, ?, ?, ?)`)
    .run(product_id, variant_id, product.name, variant.size, variant.color, -quantity, prevStock, newStock, reason || 'Stock Exit', notes || null, req.user.id);

  logActivity(req.user.id, req.user.name, 'Stock Exit', 'Product', product_id, product.sku, `${product.name}: -${quantity} (${reason})`);
  res.json({ message: 'Stock updated', previousStock: prevStock, newStock });
});

// Error handler
app.use(errorHandler);

// Initialize database and start server
try {
  initializeSchema();
  seedDatabase();

  // Auto backup cron (daily at midnight)
  cron.schedule('0 0 * * *', async () => {
    const { getDb } = require('./db/schema');
    const db = getDb();
    const autoBak = db.prepare("SELECT value FROM shop_settings WHERE key = 'auto_backup'").get();
    if (autoBak?.value === 'true') {
      console.log('Running auto backup...');
      try {
        const archiver = require('archiver');
        const fs = require('fs');
        const path = require('path');
        const { DB_PATH, dataDir } = require('./db/schema');
        const backupsDir = path.join(dataDir, 'Backups');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `auto_backup_${timestamp}.zip`;
        const filepath = path.join(backupsDir, filename);

        await new Promise((resolve, reject) => {
          const output = fs.createWriteStream(filepath);
          const archive = archiver('zip', { zlib: { level: 9 } });
          output.on('close', resolve);
          archive.on('error', reject);
          archive.pipe(output);
          archive.file(DB_PATH, { name: 'shop.db' });
          archive.finalize();
        });

        const stats = fs.statSync(filepath);
        db.prepare('INSERT INTO backups (filename, filepath, size, status) VALUES (?, ?, ?, \'Completed\')').run(filename, filepath, stats.size);
        console.log('✅ Auto backup completed:', filename);
      } catch (err) {
        console.error('Auto backup failed:', err.message);
      }
    }
  });

  app.listen(PORT, () => {
    console.log(`\n🚀 Munna Readymade Garments Server`);
    console.log(`📍 Dhobwal Bazzar`);
    console.log(`🌐 Running at http://localhost:${PORT}`);
    console.log(`🗄️  Database: Munna Readymade Garments/Database/shop.db\n`);
  });
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}

module.exports = app;
