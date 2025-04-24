import pkg from 'mikronode';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const { RouterOSAPI } = pkg;

// Environment variables
const {
  MIKROTIK_HOST,
  MIKROTIK_PORT,
  MIKROTIK_USER,
  MIKROTIK_PASSWORD
} = process.env;

// Connect to MikroTik router
const connectToRouter = async () => {
  const connection = new RouterOSAPI({
    host: MIKROTIK_HOST,
    port: MIKROTIK_PORT || 8728,
    user: MIKROTIK_USER,
    password: MIKROTIK_PASSWORD
  });
  
  try {
    await connection.connect();
    return connection;
  } catch (error) {
    console.error('Error connecting to MikroTik router:', error);
    throw new Error('Failed to connect to MikroTik router');
  }
};

// Generate a random password
export const generatePassword = (length = 8) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

// Add a hotspot user
export const addHotspotUser = async (username, password, limitUptime, comment = 'Created by WiFi Portal') => {
  let connection;
  
  try {
    connection = await connectToRouter();
    
    // Format uptime limit (e.g., '60m' for 60 minutes)
    const formattedUptime = `${limitUptime}m`;
    
    // Add user to hotspot
    const response = await connection.write('/ip/hotspot/user/add', [
      '=name=' + username,
      '=password=' + password,
      '=limit-uptime=' + formattedUptime,
      '=comment=' + comment
    ]);
    
    connection.close();
    return response;
  } catch (error) {
    if (connection) {
      connection.close();
    }
    console.error('Error adding hotspot user:', error);
    throw new Error('Failed to add hotspot user');
  }
};

// Remove a hotspot user
export const removeHotspotUser = async (username) => {
  let connection;
  
  try {
    connection = await connectToRouter();
    
    // First, find the user ID
    const users = await connection.write('/ip/hotspot/user/print');
    const user = users.find(u => u.name === username);
    
    if (!user) {
      throw new Error(`User ${username} not found`);
    }
    
    // Remove the user
    const response = await connection.write('/ip/hotspot/user/remove', [
      '=.id=' + user['.id']
    ]);
    
    connection.close();
    return response;
  } catch (error) {
    if (connection) {
      connection.close();
    }
    console.error('Error removing hotspot user:', error);
    throw new Error('Failed to remove hotspot user');
  }
};

// Get active hotspot users
export const getActiveUsers = async () => {
  let connection;
  
  try {
    connection = await connectToRouter();
    
    // Get active users
    const users = await connection.write('/ip/hotspot/active/print');
    
    connection.close();
    return users;
  } catch (error) {
    if (connection) {
      connection.close();
    }
    console.error('Error getting active users:', error);
    throw new Error('Failed to get active users');
  }
};

// Disconnect a hotspot user
export const disconnectUser = async (username) => {
  let connection;
  
  try {
    connection = await connectToRouter();
    
    // Find the active user
    const activeUsers = await connection.write('/ip/hotspot/active/print');
    const activeUser = activeUsers.find(u => u.user === username);
    
    if (!activeUser) {
      throw new Error(`Active user ${username} not found`);
    }
    
    // Disconnect the user
    const response = await connection.write('/ip/hotspot/active/remove', [
      '=.id=' + activeUser['.id']
    ]);
    
    connection.close();
    return response;
  } catch (error) {
    if (connection) {
      connection.close();
    }
    console.error('Error disconnecting user:', error);
    throw new Error('Failed to disconnect user');
  }
};