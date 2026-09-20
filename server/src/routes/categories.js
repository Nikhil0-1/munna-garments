const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate, logActivity } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/categories
router.get('/', (req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*, pc.name as parent_name,
      (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) as product_count
    FROM categories c
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE c.active = 1
    ORDER BY c.sort_order ASC, c.name ASC
  `).all();
  res.json(categories);
});

// POST /api/categories
router.post('/', (req, res, next) => {
  try {
    const db = getDb();
    const { name, parent_id, description, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const result = db.prepare(`
      INSERT INTO categories (name, slug, parent_id, description, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, slug, parent_id || null, description || null, sort_order || 0);

    logActivity(req.user.id, req.user.name, 'Category Created', 'Category', result.lastInsertRowid, null, name);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Category created' });
  } catch (err) { next(err); }
});

// PUT /api/categories/:id
router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const { name, parent_id, description, sort_order, active } = req.body;
    
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    db.prepare(`
      UPDATE categories SET name=?, slug=?, parent_id=?, description=?, sort_order=?, active=?
      WHERE id=?
    `).run(name, slug, parent_id || null, description || null, sort_order || 0, active !== false ? 1 : 0, req.params.id);

    res.json({ message: 'Category updated' });
  } catch (err) { next(err); }
});

// DELETE /api/categories/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const hasProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ? AND active = 1').get(req.params.id);
    if (hasProducts.count > 0) {
      return res.status(400).json({ error: 'Cannot delete category with active products' });
    }
    db.prepare('UPDATE categories SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
