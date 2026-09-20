const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb, dataDir } = require('../db/schema');
const { authenticate, logActivity } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Image upload setup
const uploadsDir = path.join(dataDir, 'Product Images');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `product_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ok = allowed.test(file.mimetype);
    cb(ok ? null : new Error('Images only'), ok);
  },
});

// GET /api/products - List with search, filter, pagination
router.get('/', (req, res) => {
  const db = getDb();
  const { search, category, gender, status, page = 1, limit = 20, sort = 'name' } = req.query;
  
  let where = ['p.active = 1'];
  const params = [];

  if (search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (category) {
    where.push('p.category_id = ?');
    params.push(Number(category));
  }
  if (gender) {
    where.push('p.gender = ?');
    params.push(gender);
  }
  if (status === 'low') {
    where.push('(SELECT COALESCE(SUM(pv.stock), 0) FROM product_variants pv WHERE pv.product_id = p.id) <= p.min_stock');
  } else if (status === 'out') {
    where.push('(SELECT COALESCE(SUM(pv.stock), 0) FROM product_variants pv WHERE pv.product_id = p.id) = 0');
  }

  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (Number(page) - 1) * Number(limit);
  
  const sortMap = { name: 'p.name', sku: 'p.sku', price: 'p.selling_price', stock: 'total_stock', created: 'p.created_at' };
  const sortCol = sortMap[sort] || 'p.name';

  const total = db.prepare(`SELECT COUNT(*) as count FROM products p ${whereStr}`).get(...params);
  
  const products = db.prepare(`
    SELECT p.*, c.name as category_name,
      COALESCE(SUM(pv.stock), 0) as total_stock,
      COUNT(DISTINCT pv.id) as variant_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    ${whereStr}
    GROUP BY p.id
    ORDER BY ${sortCol} ASC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({
    products,
    pagination: {
      total: total.count,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total.count / Number(limit)),
    },
  });
});

// GET /api/products/search - Quick search for POS
router.get('/search', (req, res) => {
  const db = getDb();
  const { q } = req.query;
  if (!q) return res.json([]);

  const s = `%${q}%`;
  const products = db.prepare(`
    SELECT p.id, p.name, p.sku, p.barcode, p.selling_price, p.mrp, p.gst_rate,
      c.name as category_name,
      COALESCE(SUM(pv.stock), 0) as total_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    WHERE p.active = 1 AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)
    GROUP BY p.id
    ORDER BY p.name ASC
    LIMIT 10
  `).all(s, s, s);

  // Include variants for each
  const result = products.map(p => {
    const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY size, color').all(p.id);
    return { ...p, variants };
  });

  res.json(result);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const product = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!product) return res.status(404).json({ error: 'Product not found' });

  const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY size, color').all(product.id);
  
  const salesHistory = db.prepare(`
    SELECT si.*, s.invoice_number, s.date, s.customer_name
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE si.product_id = ? ORDER BY s.date DESC LIMIT 20
  `).all(product.id);

  const stockHistory = db.prepare(`
    SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT 30
  `).all(product.id);

  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const totalSold = db.prepare(`
    SELECT COALESCE(SUM(si.quantity), 0) as qty, COALESCE(SUM(si.profit), 0) as profit
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE si.product_id = ? AND s.status = 'Completed'
  `).get(product.id);

  res.json({ ...product, variants, salesHistory, stockHistory, totalStock, totalSold });
});

// POST /api/products - Create product
router.post('/', (req, res, next) => {
  try {
    const db = getDb();
    const { name, sku, category_id, brand, fabric, pattern, gender, season, hsn_code,
            gst_rate, mrp, purchase_price, selling_price, min_stock, stock_unit,
            description, barcode, show_in_catalogue, variants } = req.body;

    if (!name || !sku) {
      return res.status(400).json({ error: 'Name and SKU are required' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    const result = db.prepare(`
      INSERT INTO products (name, slug, sku, barcode, category_id, brand, fabric, pattern,
        gender, season, hsn_code, gst_rate, mrp, purchase_price, selling_price, min_stock,
        stock_unit, description, show_in_catalogue)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, slug, sku, barcode || null, category_id || null, brand || null, fabric || null,
      pattern || null, gender || null, season || null, hsn_code || null,
      gst_rate || 5, mrp || 0, purchase_price || 0, selling_price || 0,
      min_stock || 5, stock_unit || 'Piece', description || null, show_in_catalogue ? 1 : 0);

    const productId = result.lastInsertRowid;

    // Insert variants
    if (variants && Array.isArray(variants)) {
      const insertVariant = db.prepare(`
        INSERT INTO product_variants (product_id, size, color, variant_sku, variant_barcode, stock, purchase_price, selling_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      variants.forEach(v => {
        insertVariant.run(productId, v.size || null, v.color || null, v.variant_sku || null,
          v.variant_barcode || null, v.stock || 0, v.purchase_price || purchase_price || 0,
          v.selling_price || selling_price || 0);
      });
    }

    logActivity(req.user.id, req.user.name, 'Product Created', 'Product', productId, sku, name);
    
    res.status(201).json({ id: productId, message: 'Product created successfully' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const { name, sku, category_id, brand, fabric, pattern, gender, season, hsn_code,
            gst_rate, mrp, purchase_price, selling_price, min_stock, stock_unit,
            description, barcode, show_in_catalogue, is_featured, is_new_arrival,
            is_best_seller, active, variants } = req.body;

    db.prepare(`
      UPDATE products SET name=?, sku=?, barcode=?, category_id=?, brand=?, fabric=?, pattern=?,
        gender=?, season=?, hsn_code=?, gst_rate=?, mrp=?, purchase_price=?, selling_price=?,
        min_stock=?, stock_unit=?, description=?, show_in_catalogue=?, is_featured=?,
        is_new_arrival=?, is_best_seller=?, active=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(name, sku, barcode || null, category_id || null, brand || null, fabric || null,
      pattern || null, gender || null, season || null, hsn_code || null,
      gst_rate || 5, mrp || 0, purchase_price || 0, selling_price || 0,
      min_stock || 5, stock_unit || 'Piece', description || null,
      show_in_catalogue ? 1 : 0, is_featured ? 1 : 0, is_new_arrival ? 1 : 0,
      is_best_seller ? 1 : 0, active !== false ? 1 : 0, req.params.id);

    // Update variants if provided
    if (variants && Array.isArray(variants)) {
      variants.forEach(v => {
        if (v.id) {
          db.prepare(`
            UPDATE product_variants SET size=?, color=?, variant_sku=?, stock=?, 
              purchase_price=?, selling_price=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
          `).run(v.size, v.color, v.variant_sku, v.stock, v.purchase_price, v.selling_price, v.id);
        } else {
          db.prepare(`
            INSERT INTO product_variants (product_id, size, color, variant_sku, stock, purchase_price, selling_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(req.params.id, v.size, v.color, v.variant_sku, v.stock || 0, v.purchase_price, v.selling_price);
        }
      });
    }

    logActivity(req.user.id, req.user.name, 'Product Updated', 'Product', req.params.id, sku, name);
    res.json({ message: 'Product updated successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    db.prepare('UPDATE products SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, req.user.name, 'Product Deleted', 'Product', req.params.id, product.sku, product.name);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/adjust-stock
router.post('/:id/adjust-stock', (req, res, next) => {
  try {
    const db = getDb();
    const { variant_id, quantity, reason, notes, type = 'Adjustment' } = req.body;
    
    const variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(variant_id, req.params.id);
    if (!variant) return res.status(404).json({ error: 'Variant not found' });

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    const prevStock = variant.stock;
    const newStock = prevStock + Number(quantity);

    if (newStock < 0) return res.status(400).json({ error: 'Stock cannot be negative' });

    db.prepare('UPDATE product_variants SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, variant_id);

    db.prepare(`
      INSERT INTO stock_movements (product_id, variant_id, product_name, size, color, type, quantity, 
        previous_stock, new_stock, reason, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, variant_id, product.name, variant.size, variant.color,
      type, quantity, prevStock, newStock, reason || null, notes || null, req.user.id);

    logActivity(req.user.id, req.user.name, 'Stock Adjusted', 'Product', req.params.id, product.sku, `${product.name}: ${prevStock} → ${newStock}`);
    res.json({ message: 'Stock adjusted successfully', previousStock: prevStock, newStock });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/upload-image
router.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const imageUrl = `/uploads/products/${req.file.filename}`;
  res.json({ url: imageUrl, filename: req.file.filename });
});

// GET /api/products/low-stock
router.get('/low-stock/list', (req, res) => {
  const db = getDb();
  const products = db.prepare(`
    SELECT p.id, p.name, p.sku, p.min_stock, c.name as category_name,
      COALESCE(SUM(pv.stock), 0) as current_stock,
      COUNT(DISTINCT pv.id) as variant_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    WHERE p.active = 1
    GROUP BY p.id
    HAVING current_stock <= p.min_stock
    ORDER BY current_stock ASC
  `).all();
  res.json(products);
});

// GET /api/products/:id/ledger
router.get('/:id/ledger', (req, res) => {
  const db = getDb();
  const { variant_id } = req.query;
  
  let where = 'WHERE sm.product_id = ?';
  const params = [req.params.id];
  
  if (variant_id) {
    where += ' AND sm.variant_id = ?';
    params.push(variant_id);
  }

  const movements = db.prepare(`
    SELECT sm.* FROM stock_movements sm ${where} ORDER BY sm.created_at DESC LIMIT 100
  `).all(...params);

  res.json(movements);
});

module.exports = router;
