require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDb, db } = require('./db');

const app = express();
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'smenterprises2026';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(32).toString('hex');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for Admin Authorization
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Admin access required.' });
  }
  next();
}

// 1. Admin Login API
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_TOKEN });
  } else {
    res.status(400).json({ success: false, message: 'Invalid admin password.' });
  }
});

// 2. Public Tracking API (No Auth required)
app.get('/api/track/:awb', (req, res) => {
  const awb = req.params.awb.trim();
  db.get(
    'SELECT date, awb, service, destination, status FROM shipments WHERE awb = ? OR jbn_awb = ?',
    [awb, awb],
    (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error occurred.' });
      }
      if (!row) {
        return res.status(404).json({ success: false, message: 'No shipment found with this tracking/AWB number.' });
      }
      res.json({ success: true, shipment: row });
    }
  );
});

// 3. Admin Dashboard Statistics API
app.get('/api/stats', requireAdmin, (req, res) => {
  db.get(
    `SELECT 
      COUNT(*) as totalShipments,
      SUM(CASE WHEN status != 'DLVD' THEN 1 ELSE 0 END) as activeShipments,
      SUM(sale) as totalSales,
      SUM(profit) as totalProfit
     FROM shipments`,
    [],
    (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error.' });
      }
      res.json({
        success: true,
        stats: {
          totalShipments: row.totalShipments || 0,
          activeShipments: row.activeShipments || 0,
          totalSales: parseFloat((row.totalSales || 0).toFixed(2)),
          totalProfit: parseFloat((row.totalProfit || 0).toFixed(2))
        }
      });
    }
  );
});

// 4. List Shipments API (With search, filter, and pagination)
app.get('/api/shipments', requireAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search.trim()}%` : '%';
  const service = req.query.service ? req.query.service.trim() : '%';
  const status = req.query.status ? req.query.status.trim() : '%';

  const countQuery = `
    SELECT COUNT(*) as count 
    FROM shipments 
    WHERE (shipper LIKE ? OR consignee LIKE ? OR awb LIKE ? OR jbn_awb LIKE ? OR destination LIKE ?)
      AND service LIKE ?
      AND status LIKE ?
  `;

  const dataQuery = `
    SELECT * 
    FROM shipments 
    WHERE (shipper LIKE ? OR consignee LIKE ? OR awb LIKE ? OR jbn_awb LIKE ? OR destination LIKE ?)
      AND service LIKE ?
      AND status LIKE ?
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `;

  const params = [search, search, search, search, search, service, status];

  db.get(countQuery, params, (err, countRow) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query error.' });
    }

    const totalCount = countRow ? countRow.count : 0;
    const totalPages = Math.ceil(totalCount / limit);

    db.all(dataQuery, [...params, limit, offset], (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database query error.' });
      }

      res.json({
        success: true,
        shipments: rows,
        pagination: {
          totalCount,
          totalPages,
          currentPage: page,
          limit
        }
      });
    });
  });
});

// 5. Create Shipment API
app.post('/api/shipments', requireAdmin, (req, res) => {
  const {
    date,
    jbn_awb,
    awb,
    shipper,
    consignee,
    pcs,
    weight,
    destination,
    paid_by,
    vendor,
    service,
    buying,
    sale,
    status
  } = req.body;

  if (!awb || !shipper || !consignee || !destination) {
    return res.status(400).json({ success: false, message: 'Missing required shipment fields.' });
  }

  const normalizedPcs = parseInt(pcs) || 1;
  const normalizedWeight = parseFloat(weight) || 0.0;
  const normalizedBuying = parseFloat(buying) || 0.0;
  const normalizedSale = parseFloat(sale) || 0.0;
  const profit = normalizedSale - normalizedBuying;
  const normalizedStatus = status ? status.trim().toUpperCase() : 'PENDING';

  db.run(
    `INSERT INTO shipments (
      date, jbn_awb, awb, shipper, consignee, pcs, weight, destination, paid_by, vendor, service, buying, sale, profit, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      date || new Date().toLocaleDateString('en-GB').replace(/\//g, '.'),
      jbn_awb || '',
      awb.trim(),
      shipper.trim(),
      consignee.trim(),
      normalizedPcs,
      normalizedWeight,
      destination.trim(),
      paid_by || 'Sender',
      vendor || 'Direct',
      service || 'UPS',
      normalizedBuying,
      normalizedSale,
      profit,
      normalizedStatus
    ],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ success: false, message: 'A shipment with this tracking number (AWB) already exists.' });
        }
        return res.status(500).json({ success: false, message: 'Database error occurred while saving.' });
      }
      res.json({ success: true, id: this.lastID, message: 'Shipment created successfully.' });
    }
  );
});

// 6. Update Shipment API
app.put('/api/shipments/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const {
    date,
    jbn_awb,
    awb,
    shipper,
    consignee,
    pcs,
    weight,
    destination,
    paid_by,
    vendor,
    service,
    buying,
    sale,
    status
  } = req.body;

  if (!awb || !shipper || !consignee || !destination) {
    return res.status(400).json({ success: false, message: 'Missing required shipment fields.' });
  }

  const normalizedPcs = parseInt(pcs) || 1;
  const normalizedWeight = parseFloat(weight) || 0.0;
  const normalizedBuying = parseFloat(buying) || 0.0;
  const normalizedSale = parseFloat(sale) || 0.0;
  const profit = normalizedSale - normalizedBuying;
  const normalizedStatus = status ? status.trim().toUpperCase() : 'PENDING';

  db.run(
    `UPDATE shipments SET
      date = ?,
      jbn_awb = ?,
      awb = ?,
      shipper = ?,
      consignee = ?,
      pcs = ?,
      weight = ?,
      destination = ?,
      paid_by = ?,
      vendor = ?,
      service = ?,
      buying = ?,
      sale = ?,
      profit = ?,
      status = ?
     WHERE id = ?`,
    [
      date,
      jbn_awb || '',
      awb.trim(),
      shipper.trim(),
      consignee.trim(),
      normalizedPcs,
      normalizedWeight,
      destination.trim(),
      paid_by || 'Sender',
      vendor || 'Direct',
      service || 'UPS',
      normalizedBuying,
      normalizedSale,
      profit,
      normalizedStatus,
      id
    ],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ success: false, message: 'A shipment with this tracking number (AWB) already exists.' });
        }
        return res.status(500).json({ success: false, message: 'Database error occurred while updating.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'Shipment not found.' });
      }
      res.json({ success: true, message: 'Shipment updated successfully.' });
    }
  );
});

// 7. Delete Shipment API
app.delete('/api/shipments/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM shipments WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error occurred.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }
    res.json({ success: true, message: 'Shipment deleted successfully.' });
  });
});

// 7b. Delete All Shipments API
app.delete('/api/shipments', requireAdmin, (req, res) => {
  db.run('DELETE FROM shipments', [], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error occurred while deleting all shipments.' });
    }
    res.json({ success: true, message: 'All shipments deleted successfully.' });
  });
});

// 8. Public Contact Form API
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: 'All contact fields are required.' });
  }

  const date = new Date().toLocaleString('en-GB');
  db.run(
    'INSERT INTO messages (name, email, subject, message, date) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), email.trim(), subject.trim(), message.trim(), date],
    function(err) {
      if (err) {
        console.error('Error saving contact query:', err);
        return res.status(500).json({ success: false, message: 'Failed to submit contact query.' });
      }
      console.log(`[Contact Form] Query received from ${name} (${email}): "${subject}"`);
      res.json({ success: true, message: 'Contact query submitted successfully.' });
    }
  );
});

// 9. List Admin Messages API
app.get('/api/messages', requireAdmin, (req, res) => {
  db.all('SELECT * FROM messages ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error occurred.' });
    }
    res.json({ success: true, messages: rows });
  });
});

// 10. Delete Admin Message API
app.delete('/api/messages/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM messages WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error occurred.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }
    res.json({ success: true, message: 'Message deleted successfully.' });
  });
});

// For any other routes, serve index.html (SPA routing backup, though we have specific pages)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database then start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SM Enterprises portal running at http://localhost:${PORT}`);
      if (ADMIN_PASSWORD === 'smenterprises2026') {
        console.warn('\x1b[33m%s\x1b[0m', '⚠️  [SECURITY WARNING] Using the default ADMIN_PASSWORD ("smenterprises2026") is not secure for real-world use! Please change it in your .env file or environment variables.');
      }
      if (!process.env.ADMIN_TOKEN) {
        console.log('[INFO] Admin token was generated dynamically. Restarts will require logging back in. Set the ADMIN_TOKEN environment variable for a persistent token.');
      }
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
  