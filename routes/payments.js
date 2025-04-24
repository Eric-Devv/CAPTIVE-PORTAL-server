import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db.js';
import { initiateSTKPush, querySTKStatus } from '../services/mpesa.js';
import { addHotspotUser, generatePassword } from '../services/mikrotik.js';

const router = express.Router();

// Initiate M-Pesa payment
router.post('/initiate', async (req, res) => {
  try {
    const { phoneNumber, packageId } = req.body;
    
    if (!phoneNumber || !packageId) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and package ID are required'
      });
    }
    
    const db = getDb();
    
    // Get package details
    const packageData = db.prepare('SELECT * FROM packages WHERE id = ? AND active = 1').get(packageId);
    
    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: 'Package not found or inactive'
      });
    }
    
    // Generate a unique reference for this transaction
    const reference = `WIFI-${uuidv4().substring(0, 8)}`;
    
    // Initiate STK Push
    const stkResponse = await initiateSTKPush(
      phoneNumber,
      packageData.price,
      reference
    );
    
    if (!stkResponse.CheckoutRequestID) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initiate payment'
      });
    }
    
    // Store payment record in the database
    db.prepare(`
      INSERT INTO payments (
        phone_number,
        amount,
        package_id,
        checkout_request_id,
        status
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      phoneNumber,
      packageData.price,
      packageId,
      stkResponse.CheckoutRequestID,
      'pending'
    );
    
    res.json({
      success: true,
      message: 'Payment initiated successfully',
      checkoutRequestId: stkResponse.CheckoutRequestID,
      amount: packageData.price,
      packageName: packageData.name
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment'
    });
  }
});

// Check payment status
router.get('/status/:checkoutRequestId', async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;
    
    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: 'Checkout request ID is required'
      });
    }
    
    const db = getDb();
    
    // Check if payment is already recorded as completed
    const payment = db.prepare('SELECT status FROM payments WHERE checkout_request_id = ?').get(checkoutRequestId);
    
    if (payment && payment.status === 'completed') {
      return res.json({
        success: true,
        status: 'completed'
      });
    } else if (payment && payment.status === 'failed') {
      return res.json({
        success: true,
        status: 'failed'
      });
    }
    
    // If not completed or failed, check with M-Pesa
    try {
      const stkResponse = await querySTKStatus(checkoutRequestId);
      
      if (stkResponse.ResultCode === 0) {
        // Payment successful, update database
        await processSuccessfulPayment(checkoutRequestId);
        
        return res.json({
          success: true,
          status: 'completed'
        });
      } else {
        // Payment not successful
        return res.json({
          success: true,
          status: 'pending'
        });
      }
    } catch (error) {
      // If query fails, consider payment still pending
      return res.json({
        success: true,
        status: 'pending'
      });
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
});

// M-Pesa callback endpoint
router.post('/callback', async (req, res) => {
  try {
    const { Body } = req.body;
    
    if (!Body || !Body.stkCallback) {
      return res.status(400).json({ success: false, message: 'Invalid callback data' });
    }
    
    const { ResultCode, CheckoutRequestID, CallbackMetadata } = Body.stkCallback;
    
    if (ResultCode === 0 && CallbackMetadata) {
      // Payment successful
      await processSuccessfulPayment(CheckoutRequestID);
      
      res.json({ success: true });
    } else {
      // Payment failed
      const db = getDb();
      
      db.prepare(`
        UPDATE payments
        SET status = 'failed'
        WHERE checkout_request_id = ?
      `).run(CheckoutRequestID);
      
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error);
    res.status(500).json({ success: false, message: 'Callback processing failed' });
  }
});

// Helper function to process successful payments
const processSuccessfulPayment = async (checkoutRequestId) => {
  const db = getDb();
  
  // Get payment details
  const payment = db.prepare(`
    SELECT p.id, p.phone_number, p.amount, p.package_id, pkg.minutes, pkg.name as package_name
    FROM payments p
    JOIN packages pkg ON p.package_id = pkg.id
    WHERE p.checkout_request_id = ?
  `).get(checkoutRequestId);
  
  if (!payment) {
    throw new Error('Payment not found');
  }
  
  // Generate username and password for the hotspot
  const username = `user_${payment.phone_number.substring(payment.phone_number.length - 6)}`;
  const password = generatePassword(6);
  
  // Calculate expiry time
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + payment.minutes);
  
  // Create user in database
  const userId = db.prepare(`
    INSERT INTO users (username, password, phone_number, package_id, active, expires_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `).run(
    username,
    password,
    payment.phone_number,
    payment.package_id,
    expiresAt.toISOString()
  ).lastInsertRowid;
  
  // Update payment with user ID and status
  db.prepare(`
    UPDATE payments
    SET user_id = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId, payment.id);
  
  // Add user to MikroTik
  try {
    await addHotspotUser(
      username,
      password,
      payment.minutes,
      `Auto-created for ${payment.phone_number} - ${payment.package_name}`
    );
  } catch (error) {
    console.error('Error adding user to MikroTik:', error);
    // Continue even if MikroTik integration fails
    // The user can still connect manually with the credentials
  }
  
  return { userId, username, password };
};

export default router;