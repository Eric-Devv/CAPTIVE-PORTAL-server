import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/wifi_portal.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

export const getDb = () => {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
};

export const initDatabase = () => {
  const db = getDb();
  
  // Create packages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      minutes INTEGER NOT NULL,
      active BOOLEAN NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      phone_number TEXT,
      package_id INTEGER,
      active BOOLEAN NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages (id)
    )
  `);
  
  // Create payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      amount REAL NOT NULL,
      package_id INTEGER,
      user_id INTEGER,
      mpesa_receipt_number TEXT,
      checkout_request_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);
  
  // Create admin users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Insert default packages if none exist
  const packagesCount = db.prepare('SELECT COUNT(*) as count FROM packages').get();
  
  if (packagesCount.count === 0) {
    const insertPackage = db.prepare(`
      INSERT INTO packages (name, description, price, minutes, active)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    // Default packages
    const defaultPackages = [
      {
        name: 'Hourly',
        description: 'Access for 1 hour',
        price: 20,
        minutes: 60,
        active: 1
      },
      {
        name: 'Daily',
        description: 'Access for 24 hours',
        price: 100,
        minutes: 1440,
        active: 1
      },
      {
        name: 'Weekly',
        description: 'Access for 7 days',
        price: 500,
        minutes: 10080,
        active: 1
      }
    ];
    
    defaultPackages.forEach(pkg => {
      insertPackage.run(
        pkg.name,
        pkg.description,
        pkg.price,
        pkg.minutes,
        pkg.active
      );
    });
    
    console.log('Default packages created');
  }
  
  // Insert default admin user if none exists
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin_users').get();
  
  if (adminCount.count === 0) {
    // Default admin credentials (username: admin, password: admin123)
    // In production, this should be replaced with a secure password
    db.prepare(`
      INSERT INTO admin_users (username, password)
      VALUES ('admin', 'evmwendwa')
    `).run();
    
    console.log('Default admin user created');
  }
  
  console.log('Database initialized');
};