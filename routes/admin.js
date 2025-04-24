import express from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../database/db.js';

const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'wifi_portal_secret_key';

// Auth middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ authenticated: false, message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ authenticated: false, message: 'Invalid token' });
  }
};

// Admin login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    
    const db = getDb();
    
    // Find admin user
    const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
    
    if (!admin || admin.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.json({
      success: true,
      token
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Verify JWT token
router.get('/verify', verifyToken, (req, res) => {
  res.json({ authenticated: true, user: req.user });
});

// Get dashboard stats
router.get('/stats', verifyToken, (req, res) => {
  try {
    const db = getDb();
    
    // Get active users count
    const activeUsersCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM users
      WHERE expires_at > CURRENT_TIMESTAMP
      AND active = 1
    `).get().count;
    
    // Get total users count
    const totalUsersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    
    // Get total packages count
    const totalPackagesCount = db.prepare('SELECT COUNT(*) as count FROM packages WHERE active = 1').get().count;
    
    // Get total payments and revenue
    const paymentsData = db.prepare(`
      SELECT COUNT(*) as count, SUM(amount) as revenue
      FROM payments
      WHERE status = 'completed'
    `).get();
    
    // Get success rate
    const allPaymentsCount = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;
    const successRate = allPaymentsCount > 0 
      ? Math.round((paymentsData.count / allPaymentsCount) * 100) 
      : 0;
    
    res.json({
      activeUsers: activeUsersCount,
      totalUsers: totalUsersCount,
      totalPackages: totalPackagesCount,
      totalPayments: paymentsData.count,
      revenue: paymentsData.revenue || 0,
      successRate
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// Get recent users
router.get('/users/recent', verifyToken, (req, res) => {
  try {
    const db = getDb();
    
    const users = db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.phone_number as phoneNumber,
        u.expires_at as expiresAt,
        p.name as packageName,
        CASE WHEN u.expires_at > CURRENT_TIMESTAMP AND u.active = 1
          THEN 1
          ELSE 0
        END as active
      FROM users u
      JOIN packages p ON u.package_id = p.id
      ORDER BY u.created_at DESC
      LIMIT 10
    `).all();
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching recent users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recent users' });
  }
});

// Get all users
router.get('/users', verifyToken, (req, res) => {
  try {
    const db = getDb();
    
    const users = db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.phone_number as phoneNumber,
        u.created_at as createdAt,
        u.expires_at as expiresAt,
        p.name as packageName,
        CASE WHEN u.expires_at > CURRENT_TIMESTAMP AND u.active = 1
          THEN 1
          ELSE 0
        END as active
      FROM users u
      JOIN packages p ON u.package_id = p.id
      ORDER BY u.created_at DESC
    `).all();
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Get recent payments
router.get('/payments/recent', verifyToken, (req, res) => {
  try {
    const db = getDb();
    
    const payments = db.prepare(`
      SELECT 
        pay.id,
        pay.phone_number as phoneNumber,
        pay.amount,
        pay.status,
        p.name as packageName,
        pay.created_at as createdAt
      FROM payments pay
      JOIN packages p ON pay.package_id = p.id
      ORDER BY pay.created_at DESC
      LIMIT 10
    `).all();
    
    res.json(payments);
  } catch (error) {
    console.error('Error fetching recent payments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recent payments' });
  }
});

// Get all payments
router.get('/payments', verifyToken, (req, res) => {
  try {
    const db = getDb();
    
    const payments = db.prepare(`
      SELECT 
        pay.id,
        pay.phone_number as phoneNumber,
        pay.amount,
        pay.status,
        pay.mpesa_receipt_number as mpesaReceiptNumber,
        p.name as packageName,
        pay.created_at as createdAt,
        pay.completed_at as completedAt
      FROM payments pay
      JOIN packages p ON pay.package_id = p.id
      ORDER BY pay.created_at DESC
    `).all();
    
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
});

// Get all packages
router.get('/packages', verifyToken, (req, res) => {
  try {
    const db = getDb();
    
    const packages = db.prepare(`
      SELECT 
        id,
        name,
        description,
        price,
        minutes,
        active,
        created_at as createdAt
      FROM packages
      ORDER BY price ASC
    `).all();
    
    res.json(packages);
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch packages' });
  }
});

// Add new package
router.post('/packages', verifyToken, (req, res) => {
  try {
    const { name, description, price, minutes, active } = req.body;
    
    if (!name || !price || !minutes) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and minutes are required'
      });
    }
    
    const db = getDb();
    
    const result = db.prepare(`
      INSERT INTO packages (name, description, price, minutes, active)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, description || '', price, minutes, active ? 1 : 0);
    
    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: 'Package added successfully'
    });
  } catch (error) {
    console.error('Error adding package:', error);
    res.status(500).json({ success: false, message: 'Failed to add package' });
  }
});

// Update package
router.put('/packages/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, minutes, active } = req.body;
    
    if (!id || !name || !price || !minutes) {
      return res.status(400).json({
        success: false,
        message: 'ID, name, price, and minutes are required'
      });
    }
    
    const db = getDb();
    
    db.prepare(`
      UPDATE packages
      SET name = ?, description = ?, price = ?, minutes = ?, active = ?
      WHERE id = ?
    `).run(name, description || '', price, minutes, active ? 1 : 0, id);
    
    res.json({
      success: true,
      message: 'Package updated successfully'
    });
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ success: false, message: 'Failed to update package' });
  }
});

// Change admin password
router.put('/password', verifyToken, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }
    
    const db = getDb();
    
    // Verify current password
    const admin = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.user.id);
    
    if (!admin || admin.password !== currentPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    db.prepare('UPDATE admin_users SET password = ? WHERE id = ?').run(newPassword, req.user.id);
    
    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ success: false, message: 'Failed to update password' });
  }
});

export default router;