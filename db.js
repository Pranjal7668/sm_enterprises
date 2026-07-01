const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'shipments.db');
const db = new sqlite3.Database(dbPath);

function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create table
      db.run(`
        CREATE TABLE IF NOT EXISTS shipments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT,
          jbn_awb TEXT,
          awb TEXT UNIQUE,
          shipper TEXT,
          consignee TEXT,
          pcs INTEGER,
          weight REAL,
          destination TEXT,
          paid_by TEXT,
          vendor TEXT,
          service TEXT,
          buying REAL,
          sale REAL,
          profit REAL,
          status TEXT
        )
      `, (err) => {
        if (err) return reject(err);
        console.log('Database table "shipments" initialized.');
        
        // Create messages table
        db.run(`
          CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            subject TEXT,
            message TEXT,
            date TEXT
          )
        `, (err) => {
          if (err) return reject(err);
          console.log('Database table "messages" initialized.');
          
          // Check if database has records
          db.get('SELECT COUNT(*) as count FROM shipments', [], (err, row) => {
            if (err) return reject(err);
            
            if (row.count === 0) {
              console.log('Shipments table is empty. Importing from example file .xlsx...');
              try {
                importExcelData()
                  .then(resolve)
                  .catch(reject);
              } catch (ex) {
                reject(ex);
              }
            } else {
              console.log(`Database already contains ${row.count} records. Skipping import.`);
              resolve();
            }
          });
        });
      });
    });
  });
}

function importExcelData() {
  return new Promise((resolve, reject) => {
    const excelPath = path.join(__dirname, 'example file .xlsx');
    if (!fs.existsSync(excelPath)) {
      console.warn('example file .xlsx not found in workspace root. Skipping data import.');
      return resolve();
    }
    
    try {
      const workbook = xlsx.readFile(excelPath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      
      console.log(`Found ${data.length} records in Excel file. Starting import...`);
      
      let index = 0;
      
      function insertNext() {
        if (index >= data.length) {
          console.log(`Successfully imported ${index} records from Excel to SQLite database.`);
          return resolve();
        }
        
        const row = data[index];
        const date = row['DATE'] ? String(row['DATE']).trim() : new Date().toLocaleDateString('en-GB').replace(/\//g, '.');
        const jbn_awb = row['JBN AWB NO.'] ? String(row['JBN AWB NO.']).trim() : '';
        const awb = row['AWB.NO.'] ? String(row['AWB.NO.']).trim() : `TEMP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const shipper = row['SHIPPER'] ? String(row['SHIPPER']).trim() : 'Unknown';
        const consignee = row['CONSIGNE NAME'] ? String(row['CONSIGNE NAME']).trim() : 'Unknown';
        const pcs = parseInt(row['PCS']) || 1;
        const weight = parseFloat(row['CH. WT.']) || 0.0;
        const destination = row['DESTINATION'] ? String(row['DESTINATION']).trim() : 'International';
        const paid_by = row['PAID BY'] ? String(row['PAID BY']).trim() : 'Sender';
        const vendor = row['VENDOR'] ? String(row['VENDOR']).trim() : 'Direct';
        const service = row['SERVICE'] ? String(row['SERVICE']).trim() : 'UPS';
        const buying = parseFloat(row['BUYING']) || 0.0;
        const sale = parseFloat(row['SALE']) || 0.0;
        const profit = parseFloat(row['PROFIT']) || (sale - buying);
        const status = row['STATUS'] ? String(row['STATUS']).trim().toUpperCase() : 'IN TRANSIT';
        
        db.run(`
          INSERT OR IGNORE INTO shipments (
            date, jbn_awb, awb, shipper, consignee, pcs, weight, destination, paid_by, vendor, service, buying, sale, profit, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          date, jbn_awb, awb, shipper, consignee, pcs, weight, destination, paid_by, vendor, service, buying, sale, profit, status
        ], (err) => {
          if (err) {
            console.error(`Error inserting row ${index}:`, err);
            return reject(err);
          }
          index++;
          insertNext();
        });
      }
      
      insertNext();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  db,
  initDb
};
