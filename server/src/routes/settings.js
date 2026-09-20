const express = require('express');
const { getDb } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/settings
router.get('/', (req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT key, value FROM shop_settings').all();
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json(obj);
});

// PUT /api/settings
router.put('/', (req, res) => {
  const db = getDb();
  const update = db.prepare('INSERT OR REPLACE INTO shop_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  
  const updateMany = db.transaction((data) => {
    Object.entries(data).forEach(([key, value]) => {
      update.run(key, String(value));
    });
  });
  
  updateMany(req.body);
  res.json({ message: 'Settings updated successfully' });
});

// GET /api/settings/:key
router.get('/:key', (req, res) => {
  const db = getDb();
  const setting = db.prepare('SELECT value FROM shop_settings WHERE key = ?').get(req.params.key);
  res.json({ value: setting?.value || null });
});

module.exports = router;
