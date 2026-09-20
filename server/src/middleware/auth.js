const jwt = require('jsonwebtoken');
const { getDb } = require('../db/schema');

const JWT_SECRET = process.env.JWT_SECRET || 'munna_secret';

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // ignore invalid token for public routes
    }
  }
  next();
}

function authorize(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    
    const permissions = req.user.permissions || {};
    if (permissions.all || permissions[permission]) {
      return next();
    }
    return res.status(403).json({ error: 'Permission denied' });
  };
}

function logActivity(userId, userName, action, entityType, entityId, referenceNumber, details) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, reference_number, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, userName, action, entityType, entityId, referenceNumber, details);
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  if (err.code === 'SQLITE_CONSTRAINT') {
    if (err.message.includes('UNIQUE')) {
      const field = err.message.includes('sku') ? 'SKU' : 
                    err.message.includes('barcode') ? 'Barcode' :
                    err.message.includes('invoice_number') ? 'Invoice Number' : 'Value';
      return res.status(409).json({ error: `${field} already exists` });
    }
  }
  
  res.status(500).json({ error: err.message || 'Internal server error' });
}

module.exports = { authenticate, optionalAuth, authorize, logActivity, errorHandler, JWT_SECRET };
