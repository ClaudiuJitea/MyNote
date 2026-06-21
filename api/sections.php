<?php
require_once 'config.php';
requireLogin();

ensureSortOrderColumns($pdo);
backfillSortOrders($pdo);

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];
$user_id = $_SESSION['user_id'];

if ($method === 'GET') {
    $notebook_id = $_GET['notebook_id'] ?? null;
    if (!$notebook_id) exit(json_encode([]));

    // Verify ownership
    $stmt = $pdo->prepare("SELECT id FROM notebooks WHERE id = ? AND user_id = ?");
    $stmt->execute([$notebook_id, $user_id]);
    if (!$stmt->fetch()) exit(json_encode(["error" => "Unauthorized"]));

    $stmt = $pdo->prepare("SELECT * FROM sections WHERE notebook_id = ? ORDER BY sort_order ASC, id ASC");
    $stmt->execute([$notebook_id]);
    echo json_encode($stmt->fetchAll());
} 
elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $notebook_id = $data['notebook_id'] ?? null;
    $name = $data['name'] ?? 'New Section';

    if ($notebook_id) {
        $ownerStmt = $pdo->prepare("SELECT id FROM notebooks WHERE id = ? AND user_id = ?");
        $ownerStmt->execute([$notebook_id, $user_id]);
        if (!$ownerStmt->fetch()) {
            http_response_code(403);
            echo json_encode(["error" => "Unauthorized"]);
            exit;
        }

        $sortStmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) + 10 FROM sections WHERE notebook_id = ?");
        $sortStmt->execute([$notebook_id]);
        $sortOrder = (int)$sortStmt->fetchColumn();

        $stmt = $pdo->prepare("INSERT INTO sections (notebook_id, name, sort_order) VALUES (?, ?, ?)");
        $stmt->execute([$notebook_id, $name, $sortOrder]);
        echo json_encode(["id" => $pdo->lastInsertId(), "name" => $name]);
    }
}
elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? null;
    $name = trim($data['name'] ?? '');

    if ($id && $name !== '') {
        $stmt = $pdo->prepare("
            UPDATE sections s
            JOIN notebooks n ON s.notebook_id = n.id
            SET s.name = ?
            WHERE s.id = ? AND n.user_id = ?
        ");
        $stmt->execute([$name, $id, $user_id]);
        echo json_encode(["success" => true, "name" => $name]);
    }
}
elseif ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        // Needs a JOIN to verify notebook ownership
        $stmt = $pdo->prepare("DELETE s FROM sections s JOIN notebooks n ON s.notebook_id = n.id WHERE s.id = ? AND n.user_id = ?");
        $stmt->execute([$id, $user_id]);
        echo json_encode(["success" => true]);
    }
}
?>
