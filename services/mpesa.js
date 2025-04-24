import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// M-Pesa API endpoints
const BASE_URL = 'https://sandbox.safaricom.co.ke';
const AUTH_URL = `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;
const STK_PUSH_URL = `${BASE_URL}/mpesa/stkpush/v1/processrequest`;
const QUERY_URL = `${BASE_URL}/mpesa/stkpushquery/v1/query`;

// Environment variables
const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL
} = process.env;

// Get OAuth token
export const getAccessToken = async () => {
  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    
    const response = await axios.get(AUTH_URL, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting M-Pesa access token:', error);
    throw new Error('Failed to get M-Pesa access token');
  }
};

// Format date for M-Pesa API
export const getTimestamp = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  const second = date.getSeconds().toString().padStart(2, '0');
  
  return `${year}${month}${day}${hour}${minute}${second}`;
};

// Generate password for M-Pesa API
export const generatePassword = (timestamp) => {
  const passString = `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`;
  return Buffer.from(passString).toString('base64');
};

// Initiate STK Push
export const initiateSTKPush = async (phoneNumber, amount, accountReference, callbackUrl = MPESA_CALLBACK_URL) => {
  try {
    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);
    
    // Ensure phone number is in the correct format (2547XXXXXXXX)
    let formattedPhone = phoneNumber;
    if (phoneNumber.startsWith('0')) {
      formattedPhone = '254' + phoneNumber.substring(1);
    } else if (phoneNumber.startsWith('+254')) {
      formattedPhone = phoneNumber.substring(1);
    }
    
    const data = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: 'WiFi Payment'
    };
    
    const response = await axios.post(STK_PUSH_URL, data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error initiating STK Push:', error.response?.data || error.message);
    throw new Error('Failed to initiate M-Pesa payment');
  }
};

// Query STK Push status
export const querySTKStatus = async (checkoutRequestId) => {
  try {
    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);
    
    const data = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    };
    
    const response = await axios.post(QUERY_URL, data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error querying STK status:', error.response?.data || error.message);
    throw new Error('Failed to query payment status');
  }
};