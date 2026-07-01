# VPS Deployment Guide (DigitalOcean / Hostinger / AWS / Linode)

This guide walks you through deploying the SM Enterprises Shipment & Billing Portal to a **Virtual Private Server (VPS)** running **Ubuntu** (recommended version: 22.04 or 24.04 LTS).

Deploying on a VPS gives you 100% control over the server environment and provides built-in persistent disk storage for your SQLite database.

---

## 📋 Prerequisites
1. **VPS Server:** A virtual server running a fresh installation of Ubuntu.
2. **Domain Name:** A registered domain name (e.g., `smenterprisesagra.com`).
3. **DNS Configuration:** Point your domain to your VPS IP address by setting up an **A record** in your domain registrar's DNS dashboard (e.g., `@` and `www` pointing to the VPS IP address).
4. **Git Repository:** Ensure your project is pushed to a private repository on GitHub.

---

## ⚡ Method 1: Automated Deployment (Recommended)

We have provided an automated setup script `setup-vps.sh` that updates your server, installs all required software (Node.js LTS, PM2, Nginx), sets up reverse-proxy routing, configures environment variables, and starts the portal.

### Step 1: SSH into your VPS
Open a terminal (PowerShell on Windows, or Terminal on macOS/Linux) and log in to your server:
```bash
ssh root@YOUR_VPS_IP_ADDRESS
```
*(Enter your password when prompted).*

### Step 2: Clone the Project
1. Navigate to the web hosting directory:
   ```bash
   cd /var/www
   ```
2. Clone your private repository (you may need to log into GitHub or use a Personal Access Token/SSH key):
   ```bash
   git clone https://github.com/your-username/sm-enterprises-portal.git smenterprises
   cd smenterprises
   ```

### Step 3: Run the Setup Script
1. Make the script executable:
   ```bash
   chmod +x setup-vps.sh
   ```
2. Run the script as root:
   ```bash
   sudo ./setup-vps.sh
   ```
3. Follow the interactive prompts:
   - Enter your domain name (e.g., `smenterprisesagra.com`).
   - Enter a secure password for your admin dashboard.
   - Press **Enter** to start the installation.

### Step 4: Install SSL (HTTPS) Security
To secure the admin dashboard and shipment records, obtain an SSL certificate using Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Follow the certbot prompts (enter your email, accept terms). Certbot will automatically rewrite Nginx to force secure HTTPS connections.

Your site is now live at `https://yourdomain.com`! 🎉

---

## 🛠️ Method 2: Manual Deployment (Step-by-Step Fallback)

If you prefer to configure the server manually, follow these steps:

### Step 1: Install System Dependencies
Update system packages and install Node.js (v20), Git, Nginx, and build essentials:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential software-properties-common xxd nginx

# Install Node.js LTS v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 2: Clone and Install Portal
```bash
cd /var/www
git clone https://github.com/your-username/sm-enterprises-portal.git smenterprises
cd smenterprises

# Install production dependencies (also runs assets setup automatically)
npm install --production
```

### Step 3: Configure Environment Variables
Create a production `.env` file:
```bash
nano .env
```
Paste the following configurations (replace with your secure values):
```env
PORT=3000
ADMIN_PASSWORD=your_secure_password_here
ADMIN_TOKEN=your_custom_random_hex_string
DATABASE_PATH=/var/www/smenterprises/shipments.db
```
Press `CTRL+O` and `Enter` to save, then `CTRL+X` to exit nano.

### Step 4: Configure PM2 Process Manager
PM2 keeps your Node.js application running 24/7, restarts it if it crashes, and boots it when the server restarts.
```bash
sudo npm install -g pm2
pm2 start server.js --name "smenterprises"
pm2 startup systemd
# Copy-paste the command output by the above step to enable boot startup
pm2 save
```

### Step 5: Configure Nginx Reverse Proxy
Nginx routes public internet traffic (port 80) to your Node app running on port 3000.
1. Create a configuration file:
   ```bash
   sudo nano /etc/nginx/sites-available/smenterprises
   ```
2. Paste the following configuration (replace `yourdomain.com` with your actual domain):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       client_max_body_size 20M;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
3. Enable configuration & reload Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/smenterprises /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### Step 6: SSL Setup
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 💾 Database Backups
SQLite keeps all your shipments and contact forms in the `shipments.db` file. We recommend periodically downloading this file using SFTP (via FileZilla/Cyberduck) or running a daily backup cron job:
```bash
# Example backup command
cp /var/www/smenterprises/shipments.db /var/www/smenterprises/backups/shipments-$(date +%F).db
```
