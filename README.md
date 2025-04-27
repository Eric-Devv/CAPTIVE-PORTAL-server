# WiFi Captive Portal with M-Pesa Integration

A comprehensive WiFi Captive Portal solution with M-Pesa Daraja API integration for MikroTik routers.

## Features

- Responsive captive portal with multiple package options
- M-Pesa payment integration via Daraja API
- MikroTik RouterOS API integration for access control
- Admin dashboard for monitoring and management
- SQLite database for lightweight storage

## Prerequisites

- Node.js (v16 or higher)
- MikroTik router with API access enabled
- M-Pesa Daraja API credentials
- Internet connection for the server

## Installation

1. Clone the repository:

```bash
git clone https://github.com/Eric-Devv/CAPTIVE-PORTAL.git
cd CAPTIVE-PORTAL
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on the `.env.example`:

```bash
cp .env.example .env
```

4. Update the `.env` file with your specific configuration:

- Server port
- JWT secret for admin authentication
- M-Pesa Daraja API credentials
- MikroTik router connection details
- Database path

5. Build the frontend:

```bash
npm run build
```

6. Start the server:

```bash
npm run server
```

## MikroTik Configuration

1. Enable API access on your MikroTik router:
   - Go to IP > Services
   - Ensure API service is enabled
   - Set a secure username and password

2. Configure your MikroTik hotspot:
   - Set up a captive portal
   - Configure the redirect URL to point to your server

## M-Pesa Daraja API Setup

1. Register for M-Pesa Daraja API access at [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Create a new app and get your API credentials
3. Set up your callback URL to point to `https://your-server-domain.com/api/payments/callback`

## Admin Access

Default admin credentials are:
- Username: `admin`
- Password: `admin123`

**IMPORTANT:** Change these credentials immediately after first login.

## Deployment

For production deployment, consider using:

- PM2 for process management
- Nginx as a reverse proxy
- SSL certificate for secure connections

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Developed by Eric-Devv under ERIMTECH Solutions
- Safaricom for the M-Pesa Daraja API
- MikroTik for RouterOS API
- All open-source libraries used in this project