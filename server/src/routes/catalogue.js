const express = require('express');
const QRCode = require('qrcode');
const { getDb } = require('../db/schema');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/catalogue/products - Public catalogue
router.get('/products', optionalAuth, (req, res) => {
  const db = getDb();
  const showSetting = db.prepare("SELECT value FROM shop_settings WHERE key = 'show_catalogue'").get();
  if (showSetting?.value === 'false') {
    return res.json({ products: [], categories: [], settings: {} });
  }

  const { category, gender, search, featured, new_arrivals, best_sellers, page = 1, limit = 24 } = req.query;

  let where = ['p.active = 1', 'p.show_in_catalogue = 1'];
  const params = [];

  if (search) { where.push('(p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ?)'); const q = `%${search}%`; params.push(q, q, q); }
  if (category) { where.push('(c.slug = ? OR c.id = ?)'); params.push(category, category); }
  if (gender) { where.push('p.gender = ?'); params.push(gender); }
  if (featured === 'true') { where.push('p.is_featured = 1'); }
  if (new_arrivals === 'true') { where.push('p.is_new_arrival = 1'); }
  if (best_sellers === 'true') { where.push('p.is_best_seller = 1'); }

  const whereStr = `WHERE ${where.join(' AND ')}`;
  const offset = (Number(page) - 1) * Number(limit);

  const total = db.prepare(`SELECT COUNT(*) as count FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereStr}`).get(...params);
  const products = db.prepare(`
    SELECT p.id, p.name, p.slug, p.sku, p.brand, p.fabric, p.gender, p.gst_rate,
      p.mrp, p.selling_price, p.images, p.description, p.is_featured, p.is_new_arrival, p.is_best_seller,
      c.name as category_name, c.slug as category_slug,
      COALESCE(SUM(pv.stock), 0) as total_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    ${whereStr}
    GROUP BY p.id
    ORDER BY p.is_featured DESC, p.is_new_arrival DESC, p.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  // Include variants (sizes/colors)
  const showStock = db.prepare("SELECT value FROM shop_settings WHERE key = 'catalogue_show_stock'").get();
  const showPrice = db.prepare("SELECT value FROM shop_settings WHERE key = 'catalogue_show_price'").get();

  const enriched = products.map(p => {
    const variants = db.prepare('SELECT size, color, stock FROM product_variants WHERE product_id = ? AND stock > 0 ORDER BY size, color').all(p.id);
    const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
    const colors = [...new Set(variants.map(v => v.color).filter(Boolean))];
    return {
      ...p,
      images: JSON.parse(p.images || '[]'),
      sizes,
      colors,
      in_stock: p.total_stock > 0,
      show_stock: showStock?.value !== 'false',
      show_price: showPrice?.value !== 'false',
    };
  });

  const categories = db.prepare(`
    SELECT c.id, c.name, c.slug, COUNT(p.id) as product_count
    FROM categories c
    JOIN products p ON p.category_id = c.id AND p.active = 1 AND p.show_in_catalogue = 1
    WHERE c.active = 1
    GROUP BY c.id HAVING product_count > 0
    ORDER BY c.sort_order ASC, c.name ASC
  `).all();

  const shopSettings = {};
  db.prepare("SELECT key, value FROM shop_settings WHERE key IN ('shop_name','shop_location','shop_phone','shop_whatsapp','shop_address','shop_google_maps','shop_tagline','shop_instagram')").all()
    .forEach(s => { shopSettings[s.key] = s.value; });

  const catalogueSettings = {};
  db.prepare('SELECT key, value FROM catalogue_settings').all()
    .forEach(s => { catalogueSettings[s.key] = s.value; });

  res.json({ products: enriched, categories, shopSettings, catalogueSettings, pagination: { total: total.count, page: Number(page), limit: Number(limit), pages: Math.ceil(total.count / Number(limit)) } });
});

// GET /api/catalogue/product/:slug - Public product detail
router.get('/product/:slug', optionalAuth, (req, res) => {
  const db = getDb();
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ? AND p.active = 1 AND p.show_in_catalogue = 1
  `).get(req.params.slug);

  if (!product) return res.status(404).json({ error: 'Product not found' });

  const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY size, color').all(product.id);
  const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
  const colors = [...new Set(variants.map(v => v.color).filter(Boolean))];

  const whatsapp = db.prepare("SELECT value FROM shop_settings WHERE key = 'shop_whatsapp'").get();
  const phone = db.prepare("SELECT value FROM shop_settings WHERE key = 'shop_phone'").get();
  const shopName = db.prepare("SELECT value FROM shop_settings WHERE key = 'shop_name'").get();
  const location = db.prepare("SELECT value FROM shop_settings WHERE key = 'shop_location'").get();
  const mapsLink = db.prepare("SELECT value FROM shop_settings WHERE key = 'shop_google_maps'").get();

  const whatsappMessage = encodeURIComponent(`Hello, I am interested in ${product.name} from ${shopName?.value || 'Munna Readymade Garments'}, ${location?.value || 'Dhobwal Bazzar'}. Please confirm availability.`);
  const whatsappLink = `https://wa.me/${(whatsapp?.value || '').replace(/\D/g, '')}?text=${whatsappMessage}`;

  res.json({
    ...product,
    images: JSON.parse(product.images || '[]'),
    variants, sizes, colors,
    whatsappLink, phone: phone?.value, mapsLink: mapsLink?.value,
    in_stock: variants.reduce((sum, v) => sum + v.stock, 0) > 0,
  });
});

// GET /api/catalogue/qr - Generate QR for catalogue
router.get('/qr', async (req, res) => {
  const { url } = req.query;
  const catalogueUrl = url || 'http://localhost:5173/catalogue';
  
  try {
    const qrDataUrl = await QRCode.toDataURL(catalogueUrl, {
      width: 300, margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });
    res.json({ qr: qrDataUrl, url: catalogueUrl });
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

// PUT /api/catalogue/settings - Update catalogue settings (authenticated)
router.put('/settings', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Authentication required' });
  
  const db = getDb();
  const updateSettings = db.transaction((data) => {
    Object.entries(data).forEach(([key, value]) => {
      db.prepare('INSERT OR REPLACE INTO catalogue_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, String(value));
    });
  });
  updateSettings(req.body);
  res.json({ message: 'Catalogue settings updated' });
});

// PUT /api/catalogue/products/:id/toggle
router.put('/products/:id/toggle', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Authentication required' });
  
  const db = getDb();
  const { field } = req.body; // show_in_catalogue, is_featured, is_new_arrival, is_best_seller
  const allowed = ['show_in_catalogue', 'is_featured', 'is_new_arrival', 'is_best_seller'];
  if (!allowed.includes(field)) return res.status(400).json({ error: 'Invalid field' });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const newValue = product[field] === 1 ? 0 : 1;
  db.prepare(`UPDATE products SET ${field} = ? WHERE id = ?`).run(newValue, req.params.id);
  res.json({ [field]: newValue });
});

module.exports = router;
