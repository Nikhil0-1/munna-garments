const express = require('express');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { getDb, dataDir, DB_PATH } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const backupsDir = path.join(dataDir, 'Backups');

// POST /api/backup/create - Create backup
router.post('/create', async (req, res) => {
  try {
    const db = getDb();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `backup_${timestamp}.zip`;
    const filepath = path.join(backupsDir, filename);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(filepath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      // Add database file
      archive.file(DB_PATH, { name: 'shop.db' });

      // Add uploads if exists
      const uploadsDir = path.join(dataDir, 'Product Images');
      if (fs.existsSync(uploadsDir)) {
        archive.directory(uploadsDir, 'Product Images');
      }

      archive.finalize();
    });

    const stats = fs.statSync(filepath);
    const size = stats.size;

    // Record backup
    const backupRecord = db.prepare('INSERT INTO backups (filename, filepath, size, status) VALUES (?, ?, ?, \'Completed\')').run(filename, filepath, size);

    // Clean old backups
    const keepSetting = db.prepare("SELECT value FROM shop_settings WHERE key = 'backup_keep'").get();
    const keepCount = parseInt(keepSetting?.value || '30');
    const oldBackups = db.prepare('SELECT * FROM backups ORDER BY id DESC').all();
    if (oldBackups.length > keepCount) {
      oldBackups.slice(keepCount).forEach(b => {
        try { fs.unlinkSync(b.filepath); } catch {}
        db.prepare('DELETE FROM backups WHERE id = ?').run(b.id);
      });
    }

    res.json({ id: backupRecord.lastInsertRowid, filename, size, message: 'Backup created successfully' });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Backup failed: ' + err.message });
  }
});

// GET /api/backup/list
router.get('/list', (req, res) => {
  const db = getDb();
  const backups = db.prepare('SELECT * FROM backups ORDER BY id DESC LIMIT 50').all();
  
  // Verify files still exist
  const verified = backups.map(b => ({
    ...b,
    exists: fs.existsSync(b.filepath),
    size_formatted: formatSize(b.size),
  }));

  res.json(verified);
});

// GET /api/backup/download/:id
router.get('/download/:id', (req, res) => {
  const db = getDb();
  const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(req.params.id);
  if (!backup) return res.status(404).json({ error: 'Backup not found' });
  if (!fs.existsSync(backup.filepath)) return res.status(404).json({ error: 'Backup file not found' });

  res.download(backup.filepath, backup.filename);
});

// POST /api/backup/restore/:id - Restore from backup
router.post('/restore/:id', (req, res) => {
  const db = getDb();
  const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(req.params.id);
  if (!backup) return res.status(404).json({ error: 'Backup not found' });
  if (!fs.existsSync(backup.filepath)) return res.status(404).json({ error: 'Backup file not found' });

  // For safety, just confirm — actual restore needs server restart
  res.json({
    message: 'To restore this backup, please close the application, replace the database file, and restart.',
    backupPath: backup.filepath,
    dbPath: DB_PATH,
  });
});

// DELETE /api/backup/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(req.params.id);
  if (!backup) return res.status(404).json({ error: 'Backup not found' });

  try { fs.unlinkSync(backup.filepath); } catch {}
  db.prepare('DELETE FROM backups WHERE id = ?').run(req.params.id);
  res.json({ message: 'Backup deleted' });
});

// GET /api/backup/settings
router.get('/settings', (req, res) => {
  const db = getDb();
  const settings = ['auto_backup', 'backup_frequency', 'backup_keep'].map(key => {
    const s = db.prepare('SELECT value FROM shop_settings WHERE key = ?').get(key);
    return [key, s?.value];
  });
  const obj = {}; settings.forEach(([k, v]) => { obj[k] = v; });
  const lastBackup = db.prepare('SELECT * FROM backups ORDER BY id DESC LIMIT 1').get();
  res.json({ ...obj, lastBackup, backupDir: backupsDir });
});

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

module.exports = router;
