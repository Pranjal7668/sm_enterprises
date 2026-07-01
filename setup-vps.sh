#!/bin/bash

# SM Enterprises VPS Automated Setup Script
# Designed for Ubuntu 20.04, 22.04, 24.04 LTS

# Exit immediately if a command exits with a non-zero status
set -e

# Clear screen and display banner
clear
echo -e "\033[1;34m========================================================\033[0m"
echo -e "\033[1;36m       SM ENTERPRISES PORTAL - VPS DEPLOYMENT SETUP     \033[0m"
echo -e "\033[1;34m========================================================\033[0m"
echo ""

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo -e "\033[0;31mError: Please run this script with sudo or as root.\033[0m"
  echo "Usage: sudo ./setup-vps.sh"
  exit 1
fi

# Detect project directory
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
echo -e "Project location detected: \033[1;32m$APP_DIR\033[0m"
echo ""

# ----------------------------------------------------
# 1. Gather Configuration Details
# ----------------------------------------------------
echo -e "\033[1;33m--- STEP 1: Configuration ---\033[0m"
read -p "Enter your Domain Name (e.g., smenterprisesagra.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
  echo -e "\033[0;31mError: Domain name is required.\033[0m"
  exit 1
fi

# Check if .env already exists
ENV_PATH="$APP_DIR/.env"
IF_EXIST_ENV=false
if [ -f "$ENV_PATH" ]; then
  echo -e "\033[1;32mExisting .env file detected.\033[0m"
  read -p "Do you want to overwrite your existing .env password config? (y/n): " OVERWRITE_ENV
  if [ "$OVERWRITE_ENV" = "y" ] || [ "$OVERWRITE_ENV" = "Y" ]; then
    IF_EXIST_ENV=false
  else
    IF_EXIST_ENV=true
  fi
fi

if [ "$IF_EXIST_ENV" = false ]; then
  read -sp "Set a strong Admin Dashboard Password: " ADMIN_PASS
  echo ""
  if [ -z "$ADMIN_PASS" ]; then
    ADMIN_PASS="SMEnterprise@2026"
    echo -e "No password entered. Defaulting to: \033[1;35m$ADMIN_PASS\033[0m (Please change this later!)"
  fi
fi

echo ""
echo -e "Configuration registered:"
echo -e "  Domain Name:  \033[1;32m$DOMAIN\033[0m"
echo -e "  App Directory: \033[1;32m$APP_DIR\033[0m"
echo ""
read -p "Press [Enter] to start system installation..."

# ----------------------------------------------------
# 2. Update System Packages
# ----------------------------------------------------
echo ""
echo -e "\033[1;33m--- STEP 2: Updating Ubuntu Repositories ---\033[0m"
apt update
apt upgrade -y
apt install -y curl git build-essential software-properties-common xxd

# ----------------------------------------------------
# 3. Install Node.js LTS (v20)
# ----------------------------------------------------
echo ""
echo -e "\033[1;33m--- STEP 3: Installing Node.js LTS ---\033[0m"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
else
  echo -e "Node.js is already installed (\033[1;32m$(node -v)\033[0m). Skipping installation."
fi

# Verify Node installation
echo -e "Node Version: \033[1;32m$(node -v)\033[0m"
echo -e "NPM Version:  \033[1;32m$(npm -v)\033[0m"

# ----------------------------------------------------
# 4. Install PM2 and Nginx
# ----------------------------------------------------
echo ""
echo -e "\033[1;33m--- STEP 4: Installing PM2 & Nginx ---\033[0m"
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
else
  echo -e "PM2 is already installed. Skipping global install."
fi

if ! command -v nginx &> /dev/null; then
  apt install -y nginx
else
  echo -e "Nginx is already installed. Skipping install."
fi

# Make sure Nginx is active
systemctl enable nginx
systemctl start nginx

# ----------------------------------------------------
# 5. Build App Dependencies
# ----------------------------------------------------
echo ""
echo -e "\033[1;33m--- STEP 5: Building App Dependencies ---\033[0m"
cd "$APP_DIR"
# Run npm install --production. This triggers the postinstall hook automatically.
npm install --production

# ----------------------------------------------------
# 6. Configure Environment Variables (.env)
# ----------------------------------------------------
echo ""
echo -e "\033[1;33m--- STEP 6: Creating Environment Configurations ---\033[0m"
if [ "$IF_EXIST_ENV" = false ]; then
  # Generate a cryptographically secure random 32-byte hex token for ADMIN_TOKEN
  RANDOM_TOKEN=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n' || echo "sm_enterprises_production_security_token_$(date +%s)")
  
  cat <<EOT > "$ENV_PATH"
PORT=3000
ADMIN_PASSWORD=$ADMIN_PASS
ADMIN_TOKEN=$RANDOM_TOKEN
DATABASE_PATH=$APP_DIR/shipments.db
EOT
  echo -e "Generated production \033[1;32m.env\033[0m file."
else
  echo -e "Retaining existing \033[1;32m.env\033[0m configuration."
fi

# Ensure correct permissions
chmod 600 "$ENV_PATH"

# ----------------------------------------------------
# 7. Configure Nginx Reverse Proxy
# ----------------------------------------------------
echo ""
echo -e "\033[1;33m--- STEP 7: Setting up Nginx Reverse Proxy ---\033[0m"
NGINX_CONF="/etc/nginx/sites-available/smenterprises"

cat <<EOT > "$NGINX_CONF"
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOT

# Enable site configuration and remove default
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx and reload
nginx -t
systemctl restart nginx
echo -e "Nginx successfully configured for \033[1;32m$DOMAIN\033[0m"

# ----------------------------------------------------
# 8. Start Application with PM2
# ----------------------------------------------------
echo ""
echo -e "\033[1;33m--- STEP 8: Running Server Process via PM2 ---\033[0m"
cd "$APP_DIR"

# Delete if already registered to prevent duplicates
pm2 delete smenterprises || true

# Start server
pm2 start server.js --name "smenterprises"

# Generate and display startup configurations
echo -e "Configuring PM2 to start on system boot..."
pm2 startup systemd -u root --hp /root || true
pm2 save

# ----------------------------------------------------
# 9. Complete & Setup SSL
# ----------------------------------------------------
echo ""
echo -e "\033[1;32m========================================================\033[0m"
echo -e "\033[1;32m          PORTAL DEPLOYMENT SUCCESSFUL!                 \033[0m"
echo -e "\033[1;32m========================================================\033[0m"
echo ""
echo -e "The portal is running locally on port 3000 and mapped to your domain."
echo -e "Current PM2 Status:"
pm2 status smenterprises
echo ""
echo -e "\033[1;33m⚠️  CRITICAL NEXT STEP: Install SSL (HTTPS) \033[0m"
echo -e "To secure your admin panel and user forms, run these commands:"
echo -e "  \033[1;36msudo apt install -y certbot python3-certbot-nginx\033[0m"
echo -e "  \033[1;36msudo certbot --nginx -d $DOMAIN -d www.$DOMAIN\033[0m"
echo ""
echo -e "Certbot will automatically verify your domain, install SSL, and redirect HTTP to HTTPS."
echo ""
