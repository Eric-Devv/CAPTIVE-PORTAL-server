import express from 'express';
import { getDb } from '../database/db.js';

const router = express.Router();

// Get all active packages
router.get('/', (req, res) => {
  try {
    const db = getDb();
    
    const packages = db.prepare(`
      SELECT 
        id,
        name,
        description,
        price,
        minutes,
        CASE
          WHEN minutes < 60 THEN minutes || ' minutes'
          WHEN minutes < 1440 THEN (minutes / 60) || ' hour(s)'
          WHEN minutes < 10080 THEN (minutes / 1440) || ' day(s)'
          ELSE (minutes / 10080) || ' week(s)'
        END as duration
      FROM packages
      WHERE active = 1
      ORDER BY price ASC
    `).all();
    
    res.json(packages);
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch packages' });
  }
});

// Get a single package by ID
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    const packageData = db.prepare(`
      SELECT 
        id,
        name,
        description,
        price,
        minutes,
        CASE
          WHEN minutes < 60 THEN minutes || ' minutes'
          WHEN minutes < 1440 THEN (minutes / 60) || ' hour(s)'
          WHEN minutes < 10080 THEN (minutes / 1440) || ' day(s)'
          ELSE (minutes / 10080) || ' week(s)'
        END as duration,
        active
      FROM packages
      WHERE id = ?
    `).get(id);
    
    if (!packageData) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    
    res.json(packageData);
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch package' });
  }
});

export default router;