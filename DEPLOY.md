# MyNote — Deployment on cPanel (shared hosting)

This guide is written for **shared hosting with cPanel**. You do not need root access or VPS-style server configuration.

---

## Before you start

You will need:

- A cPanel account with **PHP 8.0+** (8.1 or 8.2 recommended)
- **MySQL/MariaDB** (included on most plans)
- Your app files uploaded to the web root (usually `public_html`, or a subdomain folder)

Required PHP extensions (enable in cPanel → **Select PHP Version** or **MultiPHP INI Editor**):

- `pdo_mysql`
- `openssl`
- `zip` (for backup export/import)
- `fileinfo` (for upload validation)

---

## Step 1 — Upload the application

1. In cPanel, open **File Manager**.
2. Go to your site root (e.g. `public_html` or `public_html/mynote` for a subfolder install).
3. Upload the MyNote files (ZIP upload + **Extract**, or FTP/SFTP).

Your layout should look like:

```
public_html/
  index.html
  app.js
  api/
  uploads/
  scripts/
  ...
```

4. Ensure these folders exist and are writable:
   - `uploads/` — image uploads (755 or 775)
   - `data/` — created automatically for login rate limits; if you create it manually, set permissions to **700**

---

## Step 2 — Create the MySQL database (cPanel)

1. cPanel → **MySQL® Databases**.
2. **Create New Database** — e.g. `mynote`  
   cPanel will prefix it (e.g. `cpaneluser_mynote`). Note the **full name**.
3. **MySQL Users** → **Add New User** — choose a strong password (password manager recommended).
4. **Add User To Database** → select the user and database → grant **ALL PRIVILEGES**.

Write down:

| Setting   | Typical cPanel value                          |
|-----------|-----------------------------------------------|
| Host      | `localhost` (almost always on shared hosting) |
| Database  | Full name, e.g. `cpaneluser_mynote`           |
| Username  | Full name, e.g. `cpaneluser_mynote`           |
| Password  | The password you set in step 3                |

---

## Step 3 — Create database tables (phpMyAdmin)

1. cPanel → **phpMyAdmin**.
2. Select your database in the left sidebar.
3. Open the **SQL** tab and run the statements below (adjust names if needed).

```sql
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'member') DEFAULT 'member',
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  openrouter_api_key TEXT NULL,
  openrouter_model VARCHAR(128) NULL DEFAULT 'google/gemma-4-26b-a4b-it',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notebooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notebook_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT,
  is_favorite TINYINT(1) DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_id INT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  ocr_text LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);
```

The app may add columns automatically on first run; the tables above are enough for a fresh install.

---

## Step 4 — Create `api/config.local.php` (secrets)

**Never commit this file to git.** It stays only on the server.

### Option A — File Manager (most common on cPanel)

1. **File Manager** → open the `api/` folder.
2. Select [`api/config.example.php`](api/config.example.php) → **Copy** → name the copy `config.local.php`.
3. **Edit** `config.local.php` and set your values:

```php
<?php
return [
    'db_host' => 'localhost',
    'db_name' => 'cpaneluser_mynote',      // full database name from Step 2
    'db_user' => 'cpaneluser_mynote',      // full username from Step 2
    'db_pass' => 'your-strong-db-password',
    'app_secret' => 'paste-a-long-random-string-at-least-32-characters',
];
```

4. For `app_secret`, use a long random string (64+ characters is ideal). You can generate one locally or with any password generator — **use a unique value per site**.

### Option B — SSH / Terminal (if your host enables it)

cPanel → **Terminal** (under **Advanced**):

```bash
cd ~/public_html   # or your app path
cp api/config.example.php api/config.local.php
nano api/config.local.php   # edit and save
```

---

## Step 5 — Rotate the database password (if upgrading)

If this site ever used credentials that were stored in source code, treat the old DB password as **compromised**:

1. cPanel → **MySQL® Databases** → **Current Users** → **Change Password** for the database user.
2. Update `db_pass` in `api/config.local.php` to match.

---

## Step 6 — Remove the old web setup script

If you are upgrading from an older MyNote install:

1. **File Manager** → site root.
2. If `setup_admin.php` exists, **Delete** it.

That file allowed anyone with a browser to reset the admin account. It must not remain on a live server.

---

## Step 7 — Create the admin user

Admin setup runs **only from the command line**, not via the browser.

### Option A — cPanel Terminal (preferred)

If **Terminal** is available in cPanel:

```bash
cd ~/public_html   # adjust to your app directory
php scripts/setup_admin_cli.php your@email.com YourSecurePassword
```

Password must be at least **10 characters**.

### Option B — One-time Cron Job (no SSH)

If Terminal is not available:

1. cPanel → **Cron Jobs**.
2. Add a **Once** (or single) cron command:

```bash
/usr/local/bin/php /home/CPANELUSER/public_html/scripts/setup_admin_cli.php your@email.com YourSecurePassword
```

Replace `CPANELUSER` and the path with your account username and actual app path (File Manager shows the full path in the address bar).

3. Wait one minute, confirm the admin user works by logging in.
4. **Remove the cron job** so the command does not run again.

To find your PHP binary path, create a temporary `info.php` with `<?php phpinfo(); ?>`, open it in the browser, check **Server API** / path, then delete the file.

---

## Step 8 — HTTPS and `.htaccess`

### Enable SSL

1. cPanel → **SSL/TLS Status** or **Let's Encrypt™ SSL**.
2. Issue/install a certificate for your domain.
3. Optionally enable **Force HTTPS Redirect** (cPanel → **Domains** or **Redirects**).

Secure session cookies require HTTPS in production.

### `.htaccess`

On cPanel shared hosting, `.htaccess` is usually **already honored** in `public_html`. You do not need to change `AllowOverride` (that is managed by the host).

These files should be present after upload:

- [`.htaccess`](.htaccess) (site root) — security headers and Content-Security-Policy
- [`uploads/.htaccess`](uploads/.htaccess) — blocks PHP execution in uploaded files

If headers do not appear, contact your host and ask whether **mod_headers** is enabled for your account.

---

## Step 9 — Re-save OpenRouter API keys

After deployment, the encryption key for stored API keys may have changed. Each user who uses AI features should:

1. Log in → **Account settings**
2. Re-enter and save their OpenRouter API key

Keys encrypted before this security update may not decrypt until re-saved.

---

## Step 10 — Verify the install

1. Open `https://yourdomain.com` (or your subfolder URL).
2. Log in with the admin email and password from Step 7.
3. Create a test note and upload a small image.
4. If you see **“Server configuration missing”**, `api/config.local.php` is missing or incomplete.
5. If API actions fail with **403**, clear browser cookies for the site and reload (CSRF token is tied to the session).

---

## Security notes

- **CSRF protection** is enabled: POST/PUT/DELETE requests without a valid token return **403**.
- **`api/config.local.php`** must never be uploaded to a public repo or shared in support tickets.
- Keep **`uploads/`** writable but do not place executable scripts there.
- Use **strong, unique** passwords for the database user and admin account.

---

## Local development (not cPanel)

For development on your own machine, use:

```bash
./setup_local.sh
```

That script creates `api/config.local.php` locally and is **not** used on cPanel production hosting.
