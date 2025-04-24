import express from 'express';
import { getDb } from '../database/db.js';

const router = express.Router();

// Get connection details by checkout request ID
router.get('/details/:checkoutRequestId', (req, res) => {
  try {
    const { checkoutRequestId } = req.params;
    
    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: 'Checkout request ID is required'
      });
    }
    
    const db = getDb();
    
    // Get connection details
    const connection = db.prepare(`
      SELECT 
        u.username,
        u.password,
        u.expires_at,
        p.name as packageName,
        CASE
          WHEN p.minutes < 60 THEN p.minutes || ' minutes'
          WHEN p.minutes < 1440 THEN (p.minutes / 60) || ' hour(s)'
          WHEN p.minutes < 10080 THEN (p.minutes / 1440) || ' day(s)'
          ELSE (p.minutes / 10080) || ' week(s)'
        END as duration
      FROM users u
      JOIN payments pay ON u.id = pay.user_id
      JOIN packages p ON u.package_id = p.id
      WHERE pay.checkout_request_id = ?
      AND pay.status = 'completed'
    `).get(checkoutRequestId);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found or payment not completed'
      });
    }
    
    res.json({
      success: true,
      connection
    });
  } catch (error) {
    console.error('Error fetching connection details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch connection details'
    });
  }
});

export default router;