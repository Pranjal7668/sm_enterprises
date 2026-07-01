# SM Enterprises Portal - Production Deployment Guide

This guide outlines the step-by-step procedure to deploy the SM Enterprises Shipment & Billing Portal to the web for actual business operations.

---

## 🏗️ Recommended Hosting Stack

Since the portal is built using **Node.js (Express)** and **SQLite**, it requires a hosting provider that supports:
1. **Node.js runtime environment.**
2. **Persistent storage** (to keep your SQLite database file `shipments.db` safe when the server restarts or deploys new code).

We recommend using **[Render.com](https://render.com/)** or **[Railway.app](https://railway.app/)**. Below are the instructions for deploying on **Render**, which has a robust free/cheap tier and supports persistent disk storage.

---

## 📋 Prerequisites

1. A **GitHub** account ([Sign up here](https://github.com/)).
2. **Git** installed on your computer.
3. A **Render** account ([Sign up here](https://render.com/) using your GitHub account).

---

## 🚀 Step 1: Push your Code to GitHub

Before deploying, your code needs to be stored securely in a private repository on GitHub.

1. Open PowerShell or Command Prompt in your project folder (`C:\business project`).
2. Initialize a Git repository and commit your files:
   ```bash
   git init
   git add .
   git commit -m "Initialize SM Enterprises Portal"
   ```
3. Create a private repository on GitHub named `sm-enterprises-portal`.
4. Link your local project to GitHub and push:
   ```bash
   git remote add origin https://github.com/your-username/sm-enterprises-portal.git
   git branch -M main
   git push -u origin main
   ```

---

## ☁️ Step 2: Deploy to Render.com

1. Log in to the **Render Dashboard**.
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and select your repository (`sm-enterprises-portal`).
4. Configure the Web Service settings:
   - **Name:** `sm-enterprises`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Select the **Free** or **Starter** tier.

---

## 💾 Step 3: Add a Persistent Disk (CRITICAL)

Because SQLite saves data in a local file (`shipments.db`), Render's virtual server will wipe the database every time the server redeploys or restarts *unless* we mount a persistent disk.

1. In your Web Service settings on Render, go to the **Disks** tab.
2. Click **Add Disk**.
3. Configure the disk settings:
   - **Name:** `sqlite-data`
   - **Mount Path:** `/data`
   - **Size:** `1 GB` (Plenty for millions of shipments).
4. In your environment variables or server code, make sure the SQLite database points to the mounted disk directory.
   
   > [!NOTE]
   > We have configured the SQLite path to load relative to the project directory. If you want to use the persistent disk, simply set the environment variable:
   > `DATABASE_PATH=/data/shipments.db`

---

## 🔒 Step 4: Configure Environment Variables

1. Go to the **Environment** tab in your Render Web Service.
2. Click **Add Environment Variable** and enter:
   - `ADMIN_PASSWORD`: Your secret dashboard password (e.g. `smenterprises2026`).
   - `PORT`: `3000` (or leave blank; Render binds to its own ports automatically).
   - `DATABASE_PATH`: `/data/shipments.db` (Points to the persistent disk).
3. Click **Save Changes**. Render will automatically redeploy with your secure settings!

---

## 🌐 Step 5: Connect your Custom Domain

To use the website for actual business, you should link it to a professional domain (e.g., `smenterprisesagra.com`).

1. Go to the **Settings** tab of your Render Web Service.
2. Scroll down to **Custom Domains** and click **Add Custom Domain**.
3. Enter your domain name (e.g., `www.smenterprisesagra.com`).
4. Render will provide a **CNAME** or **A record** value. 
5. Log into your domain registrar (GoDaddy, Namecheap, Hostinger, etc.) and add the record to your DNS settings.
6. Once DNS propagates (takes 5–30 minutes), your website will go live with **automatic SSL (HTTPS)** active!

---

## 🛡️ Production Security Checklist

* [ ] **Keep Password Secret:** Never commit your password directly to GitHub. Always use Render's Environment Variables tab for `ADMIN_PASSWORD`.
* [ ] **Backup Database:** Set up a scheduled task or download the `.db` file from time to time via the server files tab to keep local backups of your invoices and records.
* [ ] **GitHub Privacy:** Ensure your GitHub repository is set to **Private** so that nobody else can see your code or server structure.
