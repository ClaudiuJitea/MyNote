<?php
require_once 'config.php';

header('Content-Type: application/json');
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?: [];

    if ($action === 'login') {
        ensureUsersStatusColumn($pdo);
        $email = trim((string)($data['email'] ?? ''));
        $password = (string)($data['password'] ?? '');

        $rateLimitError = checkLoginRateLimit($email);
        if ($rateLimitError) {
            http_response_code(429);
            echo json_encode(['error' => $rateLimitError]);
            exit;
        }

        $stmt = $pdo->prepare('SELECT id, password_hash, role, status FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            if (($user['status'] ?? 'active') === 'suspended') {
                echo json_encode(['error' => 'This account has been suspended. Contact an administrator.']);
                exit;
            }

            clearLoginAttempts($email);
            session_regenerate_id(true);
            ensureCsrfToken();

            $_SESSION['user_id'] = $user['id'];
            $_SESSION['email'] = $email;
            $_SESSION['role'] = $user['role'];
            $aiSettings = getUserAiSettings($pdo, (int)$user['id']);
            echo json_encode([
                'success' => true,
                'user_id' => $user['id'],
                'role' => $user['role'],
                'email' => $email,
                'has_ai_key' => $aiSettings['has_api_key'],
                'ai_model' => $aiSettings['model'],
                'csrf_token' => ensureCsrfToken(),
            ]);
        } else {
            recordFailedLogin($email);
            echo json_encode(['error' => 'Invalid credentials']);
        }
    } elseif ($action === 'logout') {
        session_destroy();
        echo json_encode(['success' => true]);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'csrf') {
        echo json_encode(['csrf_token' => ensureCsrfToken()]);
    } elseif ($action === 'me') {
        if (isLoggedIn()) {
            ensureUsersStatusColumn($pdo);
            $stmt = $pdo->prepare('SELECT id, email, role, status FROM users WHERE id = ?');
            $stmt->execute([$_SESSION['user_id']]);
            $user = $stmt->fetch();
            if (!$user || ($user['status'] ?? 'active') === 'suspended') {
                session_destroy();
                echo json_encode(['logged_in' => false, 'error' => 'Account suspended']);
                exit;
            }
            $aiSettings = getUserAiSettings($pdo, (int)$user['id']);
            echo json_encode([
                'logged_in' => true,
                'user_id' => (int)$user['id'],
                'email' => $user['email'],
                'role' => $user['role'],
                'status' => $user['status'] ?? 'active',
                'has_ai_key' => $aiSettings['has_api_key'],
                'ai_model' => $aiSettings['model'],
            ]);
        } else {
            echo json_encode(['logged_in' => false]);
        }
    }
}
