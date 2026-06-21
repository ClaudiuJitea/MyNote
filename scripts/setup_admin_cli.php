<?php
if (php_sapi_name() !== 'cli') {
    fwrite(STDERR, "This script must be run from the command line.\n");
    exit(1);
}

require_once __DIR__ . '/../api/config.php';

$email = $argv[1] ?? null;
$password = $argv[2] ?? null;

if (!$email) {
    fwrite(STDOUT, 'Admin email: ');
    $email = trim((string)fgets(STDIN));
}

if (!$password) {
    fwrite(STDOUT, 'Admin password: ');
    if (function_exists('readline') && stripos(PHP_OS, 'WIN') === false) {
        $password = readline('');
    } else {
        $password = trim((string)fgets(STDIN));
    }
}

$email = trim((string)$email);
$password = (string)$password;

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Valid email is required.\n");
    exit(1);
}

if (strlen($password) < 10) {
    fwrite(STDERR, "Password must be at least 10 characters.\n");
    exit(1);
}

try {
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN role ENUM('admin', 'member') DEFAULT 'member'");
    } catch (PDOException $e) {
        if ($e->getCode() != '42S21') {
            throw $e;
        }
    }

    ensureUsersStatusColumn($pdo);
    ensureAiSettingsColumns($pdo);

    $hash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);

    if ($stmt->fetch()) {
        $update = $pdo->prepare("UPDATE users SET password_hash = ?, role = 'admin', status = 'active' WHERE email = ?");
        $update->execute([$hash, $email]);
        fwrite(STDOUT, "Admin user updated: {$email}\n");
    } else {
        $insert = $pdo->prepare("INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'admin', 'active')");
        $insert->execute([$email, $hash]);
        fwrite(STDOUT, "Admin user created: {$email}\n");
    }
} catch (PDOException $e) {
    fwrite(STDERR, 'Error: ' . $e->getMessage() . "\n");
    exit(1);
}
