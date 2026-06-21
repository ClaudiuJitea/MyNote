<?php
require_once 'config.php';
requireLogin();

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden: Admins only"]);
    exit;
}

ensureUsersStatusColumn($pdo);

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];
$currentAdminId = (int)$_SESSION['user_id'];

function adminCountAdmins(PDO $pdo): int {
    $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    return (int)$stmt->fetchColumn();
}

function adminGetUser(PDO $pdo, int $id): ?array {
    $stmt = $pdo->prepare("SELECT id, email, role, status, created_at FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    return $user ?: null;
}

function adminGuardTarget(int $targetId, int $currentAdminId, string $action): ?array {
    if ($targetId === $currentAdminId && in_array($action, ['delete', 'suspend'], true)) {
        return ["error" => "You cannot {$action} your own account"];
    }
    return null;
}

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, email, role, status, created_at FROM users ORDER BY created_at DESC");
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $role = $data['role'] ?? 'member';

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(["error" => "Valid email is required"]);
        exit;
    }
    if (strlen($password) < 10) {
        echo json_encode(["error" => "Password must be at least 10 characters"]);
        exit;
    }
    if (!in_array($role, ['admin', 'member'], true)) {
        echo json_encode(["error" => "Invalid role"]);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    try {
        $stmt = $pdo->prepare("INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, ?, 'active')");
        $stmt->execute([$email, $hash, $role]);
        echo json_encode([
            "success" => true,
            "id" => (int)$pdo->lastInsertId(),
            "user" => adminGetUser($pdo, (int)$pdo->lastInsertId()),
        ]);
    } catch (PDOException $e) {
        echo json_encode(["error" => "Email already exists"]);
    }
    exit;
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = (int)($data['id'] ?? 0);
    $action = $data['action'] ?? 'reset_password';

    if (!$userId) {
        echo json_encode(["error" => "User ID required"]);
        exit;
    }

    $target = adminGetUser($pdo, $userId);
    if (!$target) {
        echo json_encode(["error" => "User not found"]);
        exit;
    }

    if ($action === 'reset_password') {
        $newPassword = $data['new_password'] ?? '';
        if (strlen($newPassword) < 10) {
            echo json_encode(["error" => "Password must be at least 10 characters"]);
            exit;
        }
        $hash = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $stmt->execute([$hash, $userId]);
        echo json_encode(["success" => true]);
        exit;
    }

    if ($action === 'suspend') {
        $guard = adminGuardTarget($userId, $currentAdminId, 'suspend');
        if ($guard) {
            echo json_encode($guard);
            exit;
        }
        if ($target['role'] === 'admin' && adminCountAdmins($pdo) <= 1) {
            echo json_encode(["error" => "Cannot suspend the last admin"]);
            exit;
        }
        $stmt = $pdo->prepare("UPDATE users SET status = 'suspended' WHERE id = ?");
        $stmt->execute([$userId]);
        echo json_encode(["success" => true, "user" => adminGetUser($pdo, $userId)]);
        exit;
    }

    if ($action === 'activate') {
        $stmt = $pdo->prepare("UPDATE users SET status = 'active' WHERE id = ?");
        $stmt->execute([$userId]);
        echo json_encode(["success" => true, "user" => adminGetUser($pdo, $userId)]);
        exit;
    }

    if ($action === 'update_role') {
        $role = $data['role'] ?? '';
        if (!in_array($role, ['admin', 'member'], true)) {
            echo json_encode(["error" => "Invalid role"]);
            exit;
        }
        if ($userId === $currentAdminId && $role !== 'admin') {
            echo json_encode(["error" => "You cannot remove your own admin role"]);
            exit;
        }
        if ($target['role'] === 'admin' && $role === 'member' && adminCountAdmins($pdo) <= 1) {
            echo json_encode(["error" => "Cannot demote the last admin"]);
            exit;
        }
        $stmt = $pdo->prepare("UPDATE users SET role = ? WHERE id = ?");
        $stmt->execute([$role, $userId]);
        echo json_encode(["success" => true, "user" => adminGetUser($pdo, $userId)]);
        exit;
    }

    echo json_encode(["error" => "Unknown action"]);
    exit;
}

if ($method === 'DELETE') {
    $userId = (int)($_GET['id'] ?? 0);
    if (!$userId) {
        echo json_encode(["error" => "User ID required"]);
        exit;
    }

    $guard = adminGuardTarget($userId, $currentAdminId, 'delete');
    if ($guard) {
        echo json_encode($guard);
        exit;
    }

    $target = adminGetUser($pdo, $userId);
    if (!$target) {
        echo json_encode(["error" => "User not found"]);
        exit;
    }

    if ($target['role'] === 'admin' && adminCountAdmins($pdo) <= 1) {
        echo json_encode(["error" => "Cannot delete the last admin"]);
        exit;
    }

    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    echo json_encode(["success" => true]);
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed"]);
