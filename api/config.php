<?php

require_once __DIR__ . '/lib/security.php';

define('OPENROUTER_DEFAULT_MODEL', 'google/gemma-4-26b-a4b-it');
define('LEGACY_APP_SETTINGS_SECRET', 'mynote-openrouter-v1');

$localConfigPath = __DIR__ . '/config.local.php';
if (!is_file($localConfigPath)) {
    if (php_sapi_name() === 'cli') {
        fwrite(STDERR, "Missing api/config.local.php — copy api/config.example.php and configure it.\n");
        exit(1);
    }
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Server configuration missing. Copy api/config.example.php to api/config.local.php.',
    ]);
    exit;
}

$appConfig = require $localConfigPath;
$host = $appConfig['db_host'] ?? 'localhost';
$dbname = $appConfig['db_name'] ?? '';
$user = $appConfig['db_user'] ?? '';
$pass = $appConfig['db_pass'] ?? '';
$appSecret = $appConfig['app_secret'] ?? '';

if ($dbname === '' || $user === '' || $appSecret === '') {
    if (php_sapi_name() === 'cli') {
        fwrite(STDERR, "api/config.local.php is incomplete.\n");
        exit(1);
    }
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server configuration is incomplete.']);
    exit;
}

if (php_sapi_name() !== 'cli') {
    initSecureSession();
    ensureCsrfToken();
    if (requiresCsrfValidation()) {
        requireCsrfToken();
    }
}

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $user,
        $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log('Database connection failed: ' . $e->getMessage());
    if (php_sapi_name() === 'cli') {
        fwrite(STDERR, "Database connection failed.\n");
        exit(1);
    }
    http_response_code(500);
    header('Content-Type: application/json');
    die(json_encode(['error' => 'Database connection failed']));
}

function getAppSecretKey(): string {
    global $appSecret;
    return hash('sha256', (string)$appSecret, true);
}

function getLegacySecretKey(): string {
    return hash('sha256', LEGACY_APP_SETTINGS_SECRET, true);
}

function isLoggedIn(): bool {
    return isset($_SESSION['user_id']);
}

function requireLogin(): void {
    if (!isLoggedIn()) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    global $pdo;
    $stmt = $pdo->prepare('SELECT status FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    $status = $user['status'] ?? 'active';

    if (!$user || $status === 'suspended') {
        session_destroy();
        http_response_code(403);
        echo json_encode(['error' => 'Account suspended']);
        exit;
    }
}

function ensureUsersStatusColumn(PDO $pdo): void {
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN status ENUM('active', 'suspended') NOT NULL DEFAULT 'active'");
    } catch (PDOException $e) {
        if ($e->getCode() != '42S21') {
            throw $e;
        }
    }
}

function ensureSortOrderColumns(PDO $pdo): void {
    foreach (['notebooks', 'sections', 'pages'] as $table) {
        try {
            $pdo->exec("ALTER TABLE {$table} ADD COLUMN sort_order INT NOT NULL DEFAULT 0");
        } catch (PDOException $e) {
            if ($e->getCode() != '42S21') {
                throw $e;
            }
        }
    }
}

function backfillSortOrders(PDO $pdo): void {
    static $done = false;
    if ($done) {
        return;
    }

    $pdo->exec('UPDATE notebooks SET sort_order = id * 10 WHERE sort_order = 0');
    $pdo->exec('UPDATE sections SET sort_order = id * 10 WHERE sort_order = 0');
    $pdo->exec('UPDATE pages SET sort_order = id * 10 WHERE sort_order = 0');
    $done = true;
}

function ensureAiSettingsColumns(PDO $pdo): void {
    try {
        $pdo->exec('ALTER TABLE users ADD COLUMN openrouter_api_key TEXT NULL');
    } catch (PDOException $e) {
        if ($e->getCode() != '42S21') {
            throw $e;
        }
    }

    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN openrouter_model VARCHAR(128) NULL DEFAULT '" . OPENROUTER_DEFAULT_MODEL . "'");
    } catch (PDOException $e) {
        if ($e->getCode() != '42S21') {
            throw $e;
        }
    }
}

function encryptSetting(string $value): string {
    $key = getAppSecretKey();
    $iv = random_bytes(12);
    $tag = '';
    $encrypted = openssl_encrypt($value, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if ($encrypted === false) {
        throw new RuntimeException('Encryption failed');
    }
    return 'gcm:' . base64_encode($iv . $tag . $encrypted);
}

function decryptLegacyCbc(?string $payload): ?string {
    if (!$payload || str_starts_with($payload, 'gcm:')) {
        return null;
    }

    $raw = base64_decode($payload, true);
    if ($raw === false || strlen($raw) < 17) {
        return null;
    }

    $iv = substr($raw, 0, 16);
    $encrypted = substr($raw, 16);
    $key = getLegacySecretKey();
    $decrypted = openssl_decrypt($encrypted, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);

    return $decrypted === false ? null : $decrypted;
}

function decryptSetting(?string $payload): ?string {
    if (!$payload) {
        return null;
    }

    if (str_starts_with($payload, 'gcm:')) {
        $raw = base64_decode(substr($payload, 4), true);
        if ($raw === false || strlen($raw) < 29) {
            return null;
        }

        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $encrypted = substr($raw, 28);
        $key = getAppSecretKey();
        $decrypted = openssl_decrypt($encrypted, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);

        return $decrypted === false ? null : $decrypted;
    }

    return decryptLegacyCbc($payload);
}

function maskApiKey(?string $key): ?string {
    if (!$key) {
        return null;
    }

    $length = strlen($key);
    if ($length <= 8) {
        return str_repeat('•', $length);
    }

    return substr($key, 0, 8) . '…' . substr($key, -4);
}

function getSuggestedOpenRouterModels(): array {
    return [
        OPENROUTER_DEFAULT_MODEL => 'Gemma 4 26B (recommended)',
        'google/gemma-4-26b-a4b-it:free' => 'Gemma 4 26B (free tier)',
        'google/gemma-4-31b-it' => 'Gemma 4 31B',
        'google/gemma-4-31b-it:free' => 'Gemma 4 31B (free tier)',
        'google/gemma-4-e4b-it' => 'Gemma 4 E4B (lighter)',
    ];
}

/** @deprecated Use getSuggestedOpenRouterModels() */
function getAllowedOpenRouterModels(): array {
    return getSuggestedOpenRouterModels();
}

function normalizeOpenRouterModel(?string $model): ?string {
    $model = trim((string)$model);
    if ($model === '') {
        return null;
    }

    if (strlen($model) > 128) {
        return null;
    }

    if (!preg_match('/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i', $model)) {
        return null;
    }

    return $model;
}

function resolveOpenRouterModel(?string $model): string {
    $normalized = normalizeOpenRouterModel($model);
    return $normalized ?? OPENROUTER_DEFAULT_MODEL;
}

function getUserAiSettings(PDO $pdo, int $userId): array {
    ensureAiSettingsColumns($pdo);

    $stmt = $pdo->prepare('SELECT openrouter_api_key, openrouter_model FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch() ?: [];

    $apiKey = decryptSetting($row['openrouter_api_key'] ?? null);
    $model = resolveOpenRouterModel($row['openrouter_model'] ?? OPENROUTER_DEFAULT_MODEL);

    return [
        'has_api_key' => !empty($apiKey),
        'api_key_masked' => maskApiKey($apiKey),
        'model' => $model,
        'recommended_model' => OPENROUTER_DEFAULT_MODEL,
        'suggested_models' => getSuggestedOpenRouterModels(),
        'available_models' => getSuggestedOpenRouterModels(),
    ];
}

function getUserOpenRouterCredentials(PDO $pdo, int $userId): ?array {
    ensureAiSettingsColumns($pdo);

    $stmt = $pdo->prepare('SELECT openrouter_api_key, openrouter_model FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }

    $apiKey = decryptSetting($row['openrouter_api_key'] ?? null);
    if (!$apiKey) {
        return null;
    }

    $model = resolveOpenRouterModel($row['openrouter_model'] ?? OPENROUTER_DEFAULT_MODEL);

    return [
        'api_key' => $apiKey,
        'model' => $model,
    ];
}
