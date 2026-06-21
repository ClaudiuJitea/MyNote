<?php
require_once 'config.php';
requireLogin();

ensureSortOrderColumns($pdo);
backfillSortOrders($pdo);

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];
$user_id = $_SESSION['user_id'];

if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT * FROM notebooks WHERE user_id = ? ORDER BY sort_order ASC, id ASC");
    $stmt->execute([$user_id]);
    echo json_encode($stmt->fetchAll());
} 
elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $name = $data['name'] ?? 'Untitled Notebook';

    $sortStmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) + 10 FROM notebooks WHERE user_id = ?");
    $sortStmt->execute([$user_id]);
    $sortOrder = (int)$sortStmt->fetchColumn();

    $stmt = $pdo->prepare("INSERT INTO notebooks (user_id, name, sort_order) VALUES (?, ?, ?)");
    $stmt->execute([$user_id, $name, $sortOrder]);
    echo json_encode(["id" => $pdo->lastInsertId(), "name" => $name]);
}
elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? null;
    $name = trim($data['name'] ?? '');

    if ($id && $name !== '') {
        $stmt = $pdo->prepare("UPDATE notebooks SET name = ? WHERE id = ? AND user_id = ?");
        $stmt->execute([$name, $id, $user_id]);
        echo json_encode(["success" => true, "name" => $name]);
    }
}
elseif ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $stmt = $pdo->prepare("DELETE FROM notebooks WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $user_id]);
        echo json_encode(["success" => true]);
    }
}
?>
