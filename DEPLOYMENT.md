# EisaX Wealth Portal - Production Deployment

## Current Production State

| Item | Value |
|------|-------|
| App path | `/opt/emcoin/app` |
| Database | `/opt/emcoin/data/emcoin.sqlite` |
| Uploads | `/opt/emcoin/uploads/statements` |
| Logs | `/opt/emcoin/logs/` |
| Backups | `/opt/emcoin/backups/` |
| Scripts | `/opt/emcoin/scripts/` |
| Nginx config | `/etc/nginx/sites-available/emcoin` |
| PM2 config | `/opt/emcoin/app/ecosystem.config.js` |
| Public URL | `http://YOUR_SERVER_IP` |
| API (internal) | `127.0.0.1:4000` |
| Web (internal) | `127.0.0.1:3000` |

## Quick Reference

### PM2 Commands

```bash
pm2 status                  # Check process status
pm2 logs emcoin-api         # View API logs
pm2 logs emcoin-web         # View web logs
pm2 restart all             # Restart both processes
pm2 restart emcoin-api      # Restart API only
pm2 restart emcoin-web      # Restart web only
pm2 stop all                # Stop all processes
pm2 save                    # Save current process list
pm2 startup                 # Generate startup script (run once)
```

### Nginx Commands

```bash
sudo nginx -t                    # Test configuration
sudo systemctl reload nginx      # Reload without downtime
sudo systemctl restart nginx     # Full restart
sudo systemctl status nginx      # Check status
cat /etc/nginx/sites-available/emcoin  # View config
```

### Deployment Workflow

```bash
# 1. Pull latest code
cd /opt/emcoin/app
git pull

# 2. Install dependencies
npm ci

# 3. Type check
npm run type-check && npm run type-check:server

# 4. Build
npm run build && npm run build:server

# 5. Restart
pm2 restart all

# 6. Verify
curl -s http://127.0.0.1:4000/api/health
curl -s http://127.0.0.1:3000/login
curl -s http://YOUR_SERVER_IP/api/health
curl -s http://YOUR_SERVER_IP/login
```

## Backup & Restore

### Manual Backup

```bash
/opt/emcoin/scripts/backup.sh
```

### Scheduled Backup (Cron)

```bash
# Edit crontab
crontab -e

# Add this line for daily 2 AM backups:
0 2 * * * /opt/emcoin/scripts/backup.sh >> /opt/emcoin/logs/backup.log 2>&1
```

### Restore Database

```bash
# Stop PM2 first
pm2 stop all

# List available backups
ls -lh /opt/emcoin/backups/

# Restore from specific backup
/opt/emcoin/scripts/restore.sh db /opt/emcoin/backups/emcoin_20260521_020000.sqlite.gz
```

### Restore Uploads

```bash
/opt/emcoin/scripts/restore.sh uploads /opt/emcoin/backups/uploads_20260521_020000.tar.gz
```

## Admin Password Rotation

### Using the Reset Script

```bash
# Interactive mode
node /opt/emcoin/scripts/reset-admin-password.js

# Direct mode
node /opt/emcoin/scripts/reset-admin-password.js admin@emcoin.local "NewSecurePass123!"
```

### Security Notes

- The reset script requires access to `/opt/emcoin/data/emcoin.sqlite`
- After initial setup, consider restricting the script:
  ```bash
  sudo chmod 700 /opt/emcoin/scripts/reset-admin-password.js
  sudo chown ubuntu:ubuntu /opt/emcoin/scripts/reset-admin-password.js
  ```
- Default seeded passwords should be changed immediately in production
- The seed script (`npm run db:seed`) should NEVER be run in production

## Security Configuration

### Firewall (iptables)

Only ports 22 (SSH) and 80 (HTTP) are open:

```bash
sudo iptables -L INPUT -n --line-numbers
```

Expected rules:
- Port 80: ACCEPT (Nginx)
- Port 22: ACCEPT (SSH)
- All other: REJECT

Rules are persisted in `/etc/iptables/rules.v4` and survive reboot.

### Internal Bindings

- API binds to `127.0.0.1:4000` only (not externally accessible)
- Web binds to `127.0.0.1:3000` only (not externally accessible)
- All public access goes through Nginx on port 80

### JWT Secret

- Stored in `/opt/emcoin/app/.env`
- Must be a strong random string (min 16 chars)
- Server refuses to start with default/weak secret
- To rotate: generate new secret, update `.env`, run `pm2 restart all`

```bash
# Generate new secret
openssl rand -hex 48

# Update .env
nano /opt/emcoin/app/.env

# Restart
pm2 restart all
```

## Nginx Configuration

Location: `/etc/nginx/sites-available/emcoin`

Routes:
- `/` → `127.0.0.1:3000` (Next.js frontend)
- `/api/` → `127.0.0.1:4000/api/` (Express API)

Security headers added:
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

## Domain + HTTPS (Next Steps)

When a domain is available:

### 1. Update DNS

Point your domain (e.g., `portal.example.com`) to `YOUR_SERVER_IP`.

### 2. Update .env

```
API_ORIGIN=https://portal.example.com
NEXT_PUBLIC_API_URL=https://portal.example.com/api
```

### 3. Update Nginx

Edit `/etc/nginx/sites-available/emcoin`:
```
server_name portal.example.com;
```

### 4. Install SSL Certificate

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d portal.example.com
```

### 5. Rebuild Frontend

```bash
cd /opt/emcoin/app
npm run build
pm2 restart emcoin-web
```

### 6. Update Firewall (Optional)

```bash
sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
```

## Troubleshooting

### PM2 Process Crashed

```bash
pm2 logs emcoin-api --lines 100
pm2 logs emcoin-web --lines 100
```

### Nginx 502 Bad Gateway

```bash
# Check if backend processes are running
pm2 status

# Check Nginx error log
sudo tail -50 /var/log/nginx/error.log
```

### Database Locked

```bash
# Check for WAL mode
sqlite3 /opt/emcoin/data/emcoin.sqlite "PRAGMA journal_mode;"

# Should return: wal
```

### Port Already in Use

```bash
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:4000 | xargs kill -9
pm2 restart all
```
