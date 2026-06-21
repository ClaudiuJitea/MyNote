# MyNote

Self-hosted note-taking web app with a folder-style hierarchy, rich text editing, search, image uploads, optional AI assistance, and multi-user support. Runs on shared hosting (cPanel) or locally with PHP and MySQL.

The UI is branded **MyNotes**; the repository and deployment docs use **MyNote**.

![MyNotes editor with sidebar, rich text formatting, and AI tools](img/main.png)

## Screenshots

### Dark mode

Light and dark themes with the same layout and features.

![MyNotes dashboard in dark mode](img/dark.png)

### Account settings

Personal OpenRouter API key, model selection, and per-user backup export/import.

![Account settings with AI and backup options](img/account_panel.png)

### Admin panel

User management, system-wide backup, and admin AI configuration.

![Admin panel with AI settings and user management](img/adm_panel.png)

![Admin panel user list and system backup](img/adm_panel2.png)

## Features

- **Hierarchy** — Organize notes in notebooks, sections, and pages with drag-and-drop reordering
- **Rich text editor** — Write and format notes with [Quill](https://quilljs.com/)
- **Search** — Full-text search across all of your notes
- **Images** — Upload images to notes; OCR text is stored for search
- **Favorites** — Mark pages as favorites for quick access
- **Themes** — Light and dark mode
- **Multi-user** — Admin and member roles; admins manage users from the admin panel
- **AI (optional)** — Connect your own [OpenRouter](https://openrouter.ai/) API key to translate, summarize, generate content, create flashcards, quizzes, study plans, and more
- **Backup** — Export and import your data as a portable `.mynote.zip` archive
- **Security** — Session-based auth, CSRF protection, login rate limiting, encrypted AI keys on the server

## Requirements

- **PHP 8.0+** (8.1 or 8.2 recommended)
- **MySQL or MariaDB**
- PHP extensions: `pdo_mysql`, `openssl`, `zip` (backup export/import), `fileinfo` (upload validation)

## Quick start (local development)

On a Linux machine with PHP, MySQL, and `sudo` access:

```bash
git clone https://github.com/ClaudiuJitea/MyNote.git
cd MyNote
./setup_local.sh
php -S localhost:8000
```

Open [http://localhost:8000](http://localhost:8000). The setup script prints the generated admin email and password.

Environment variables (optional):

| Variable       | Default            | Description              |
|----------------|--------------------|--------------------------|
| `DB_NAME`      | `mynote_local`     | MySQL database name      |
| `DB_USER`      | `mynote_local`     | MySQL user               |
| `DB_PASS`      | (random)           | MySQL password           |
| `ADMIN_EMAIL`  | `admin@example.com` | Initial admin email     |
| `ADMIN_PASS`   | (random)           | Initial admin password   |

### Manual local setup

1. Copy `api/config.example.php` to `api/config.local.php` and fill in database credentials and a long random `app_secret`.
2. Create the database and tables (see [DEPLOY.md](DEPLOY.md) Step 3 for the SQL schema).
3. Create an admin user:

   ```bash
   php scripts/setup_admin_cli.php admin@example.com 'your-secure-password'
   ```

4. Ensure writable directories exist:

   ```bash
   mkdir -p uploads data/rate_limits
   chmod 775 uploads
   chmod 700 data data/rate_limits
   ```

5. Start the built-in PHP server:

   ```bash
   php -S localhost:8000
   ```

## Production deployment

For shared hosting with cPanel (upload, database, permissions, first admin user, troubleshooting), see **[DEPLOY.md](DEPLOY.md)**.

## Configuration

All secrets live in `api/config.local.php`, which is gitignored and must not be committed:

```php
<?php
return [
    'db_host' => 'localhost',
    'db_name' => 'your_db_name',
    'db_user' => 'your_db_user',
    'db_pass' => 'your_db_password',
    'app_secret' => 'generate-a-long-random-string-at-least-32-chars',
];
```

Copy from [`api/config.example.php`](api/config.example.php) as a starting point.

## Project structure

```
MyNote/
  index.html          # App shell
  app.js              # Frontend logic
  style.css           # Styles (light/dark themes)
  api/                # PHP JSON API
    auth.php          # Login, logout, session
    notebooks.php     # Notebooks CRUD
    sections.php      # Sections CRUD
    pages.php         # Pages CRUD
    search.php        # Full-text search
    upload.php        # Image uploads
    ai.php            # OpenRouter AI actions
    export.php        # Backup export
    import.php        # Backup import
    admin.php         # User management (admin only)
    config.php        # Bootstrap, DB, security helpers
    lib/              # Shared PHP libraries
  scripts/
    setup_admin_cli.php   # CLI admin user setup
  img/                # README screenshots
  uploads/            # User-uploaded images (writable)
  data/               # Rate-limit state (writable, auto-created)
  setup_local.sh      # Local dev bootstrap script
  DEPLOY.md           # cPanel deployment guide
```

## AI setup

AI features are optional. Each user adds their own OpenRouter API key in **Account settings**. Keys are encrypted on the server and are never returned to the browser after saving. Without a key, the rest of the app works normally.

Default model: `google/gemma-4-26b-a4b-it` (configurable per user).

## Backup and restore

- **Export** — Download a `.mynote.zip` archive containing your notebooks, notes, and images.
- **Import** — Restore from a previously exported archive (from Account settings).
- Admins can also export a full system backup.

Requires the PHP `zip` extension.

## Security notes

- Never commit `api/config.local.php` or real credentials.
- Rotate database passwords if they were ever exposed.
- Set `uploads/` to `755` or `775` and `data/` to `700` on production servers.
- Use HTTPS in production so session cookies and credentials are protected in transit.

## License

No license file is included in this repository. Add one if you intend to open-source or distribute the project.
