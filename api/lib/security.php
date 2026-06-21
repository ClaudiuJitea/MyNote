<?php

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 900;

function mynoteProjectRoot(): string {
    return dirname(__DIR__, 2);
}

function mynoteRateLimitDir(): string {
    $dir = mynoteProjectRoot() . '/data/rate_limits';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    return $dir;
}

function initSecureSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443);

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');

    session_start();
}

function getClientIp(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function ensureCsrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function getSubmittedCsrfToken(): ?string {
    $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
    if (is_string($header) && $header !== '') {
        return $header;
    }

    if (isset($_POST['csrf_token']) && is_string($_POST['csrf_token'])) {
        return $_POST['csrf_token'];
    }

    return null;
}

function csrfIsExemptRoute(): bool {
    $script = basename($_SERVER['SCRIPT_NAME'] ?? '');
    if ($script !== 'auth.php') {
        return false;
    }

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        return false;
    }

    return ($_GET['action'] ?? '') === 'login';
}

function requiresCsrfValidation(): bool {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
        return false;
    }

    return !csrfIsExemptRoute();
}

function requireCsrfToken(): void {
    $expected = $_SESSION['csrf_token'] ?? '';
    $submitted = getSubmittedCsrfToken();

    if ($expected === '' || $submitted === null || !hash_equals($expected, $submitted)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid or missing CSRF token']);
        exit;
    }
}

function loginRateLimitKey(string $email): string {
    return hash('sha256', getClientIp() . '|' . strtolower(trim($email)));
}

function readLoginAttempts(string $email): array {
    $path = mynoteRateLimitDir() . '/' . loginRateLimitKey($email) . '.json';
    if (!is_file($path)) {
        return ['count' => 0, 'first_attempt' => time(), 'locked_until' => 0];
    }

    $data = json_decode((string)file_get_contents($path), true);
    if (!is_array($data)) {
        return ['count' => 0, 'first_attempt' => time(), 'locked_until' => 0];
    }

    return array_merge(
        ['count' => 0, 'first_attempt' => time(), 'locked_until' => 0],
        $data
    );
}

function writeLoginAttempts(string $email, array $data): void {
    $path = mynoteRateLimitDir() . '/' . loginRateLimitKey($email) . '.json';
    file_put_contents($path, json_encode($data), LOCK_EX);
}

function checkLoginRateLimit(string $email): ?string {
    $now = time();
    $data = readLoginAttempts($email);

    if (($data['locked_until'] ?? 0) > $now) {
        return 'Too many failed login attempts. Try again later.';
    }

    if (($data['first_attempt'] ?? $now) + LOGIN_WINDOW_SECONDS < $now) {
        return null;
    }

    if (($data['count'] ?? 0) >= LOGIN_MAX_ATTEMPTS) {
        $data['locked_until'] = $now + LOGIN_WINDOW_SECONDS;
        writeLoginAttempts($email, $data);
        return 'Too many failed login attempts. Try again later.';
    }

    return null;
}

function recordFailedLogin(string $email): void {
    $now = time();
    $data = readLoginAttempts($email);

    if (($data['first_attempt'] ?? $now) + LOGIN_WINDOW_SECONDS < $now) {
        $data = ['count' => 0, 'first_attempt' => $now, 'locked_until' => 0];
    }

    $data['count'] = (int)($data['count'] ?? 0) + 1;
    if ($data['count'] >= LOGIN_MAX_ATTEMPTS) {
        $data['locked_until'] = $now + LOGIN_WINDOW_SECONDS;
    }

    writeLoginAttempts($email, $data);
    sleep(1);
}

function clearLoginAttempts(string $email): void {
    $path = mynoteRateLimitDir() . '/' . loginRateLimitKey($email) . '.json';
    if (is_file($path)) {
        @unlink($path);
    }
}
