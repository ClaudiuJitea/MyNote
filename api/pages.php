<?php
require_once 'config.php';
requireLogin();

ensureSortOrderColumns($pdo);
backfillSortOrders($pdo);

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];
$user_id = $_SESSION['user_id'];

if ($method === 'GET') {
    $section_id = $_GET['section_id'] ?? null;
    $page_id = $_GET['page_id'] ?? null;

    if (isset($_GET['highlights'])) {
        $recentIds = [];
        if (!empty($_GET['recent'])) {
            $recentIds = array_values(array_unique(array_filter(array_map('intval', explode(',', (string)$_GET['recent'])))));
            $recentIds = array_slice($recentIds, 0, 3);
        }

        $pageFields = '
            p.id, p.section_id, p.title, p.is_favorite, p.updated_at,
            s.name AS section_name, n.name AS notebook_name, n.id AS notebook_id
        ';

        $favoritesStmt = $pdo->prepare("
            SELECT {$pageFields}
            FROM pages p
            JOIN sections s ON p.section_id = s.id
            JOIN notebooks n ON s.notebook_id = n.id
            WHERE n.user_id = ? AND p.is_favorite = 1
            ORDER BY p.updated_at DESC
            LIMIT 3
        ");
        $favoritesStmt->execute([$user_id]);
        $favorites = $favoritesStmt->fetchAll();

        $recent = [];
        if ($recentIds) {
            $placeholders = implode(',', array_fill(0, count($recentIds), '?'));
            $recentStmt = $pdo->prepare("
                SELECT {$pageFields}
                FROM pages p
                JOIN sections s ON p.section_id = s.id
                JOIN notebooks n ON s.notebook_id = n.id
                WHERE n.user_id = ? AND p.id IN ({$placeholders})
            ");
            $recentStmt->execute(array_merge([$user_id], $recentIds));
            $byId = [];
            foreach ($recentStmt->fetchAll() as $row) {
                $byId[(int)$row['id']] = $row;
            }
            foreach ($recentIds as $id) {
                if (isset($byId[$id])) {
                    $recent[] = $byId[$id];
                }
            }
        }

        echo json_encode(['favorites' => $favorites, 'recent' => $recent]);
        exit;
    }

    if (isset($_GET['starred'])) {
        $stmt = $pdo->prepare("
            SELECT
                p.id, p.section_id, p.title, p.is_favorite, p.updated_at,
                s.name AS section_name, n.name AS notebook_name, n.id AS notebook_id
            FROM pages p
            JOIN sections s ON p.section_id = s.id
            JOIN notebooks n ON s.notebook_id = n.id
            WHERE n.user_id = ? AND p.is_favorite = 1
            ORDER BY p.updated_at DESC
        ");
        $stmt->execute([$user_id]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    if ($page_id) {
        $stmt = $pdo->prepare("
            SELECT p.* FROM pages p 
            JOIN sections s ON p.section_id = s.id 
            JOIN notebooks n ON s.notebook_id = n.id 
            WHERE p.id = ? AND n.user_id = ?
        ");
        $stmt->execute([$page_id, $user_id]);
        echo json_encode($stmt->fetch());
    } elseif ($section_id) {
        $stmt = $pdo->prepare("
            SELECT p.id, p.section_id, p.title, p.is_favorite, p.created_at, p.updated_at 
            FROM pages p 
            JOIN sections s ON p.section_id = s.id 
            JOIN notebooks n ON s.notebook_id = n.id 
            WHERE p.section_id = ? AND n.user_id = ?
            ORDER BY p.sort_order ASC, p.id ASC
        ");
        $stmt->execute([$section_id, $user_id]);
        echo json_encode($stmt->fetchAll());
    } else {
        echo json_encode([]);
    }
} 
elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $section_id = $data['section_id'] ?? null;
    $title = $data['title'] ?? 'Untitled';
    $content = $data['content'] ?? '';

    if ($section_id) {
        $ownerStmt = $pdo->prepare("
            SELECT s.id FROM sections s
            JOIN notebooks n ON s.notebook_id = n.id
            WHERE s.id = ? AND n.user_id = ?
        ");
        $ownerStmt->execute([$section_id, $user_id]);
        if (!$ownerStmt->fetch()) {
            http_response_code(403);
            echo json_encode(["error" => "Unauthorized"]);
            exit;
        }

        $sortStmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) + 10 FROM pages WHERE section_id = ?");
        $sortStmt->execute([$section_id]);
        $sortOrder = (int)$sortStmt->fetchColumn();

        $stmt = $pdo->prepare("INSERT INTO pages (section_id, title, content, sort_order) VALUES (?, ?, ?, ?)");
        $stmt->execute([$section_id, $title, $content, $sortOrder]);
        echo json_encode(["id" => $pdo->lastInsertId(), "title" => $title]);
    }
}
elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? null;
    $title = $data['title'] ?? null;
    $content = $data['content'] ?? null;
    $is_favorite = isset($data['is_favorite']) ? (int)$data['is_favorite'] : null;

    if ($id) {
        $updates = [];
        $params = [];
        if ($title !== null) { $updates[] = "title = ?"; $params[] = $title; }
        if ($content !== null) { $updates[] = "content = ?"; $params[] = $content; }
        if ($is_favorite !== null) { $updates[] = "is_favorite = ?"; $params[] = $is_favorite; }
        
        if (count($updates) > 0) {
            $params[] = $id;
            $params[] = $user_id; // auth check
            
            $sql = "UPDATE pages p 
                    JOIN sections s ON p.section_id = s.id 
                    JOIN notebooks n ON s.notebook_id = n.id 
                    SET " . implode(', ', $updates) . " 
                    WHERE p.id = ? AND n.user_id = ?";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            echo json_encode(["success" => true]);
        }
    }
}
elseif ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $stmt = $pdo->prepare("DELETE p FROM pages p JOIN sections s ON p.section_id = s.id JOIN notebooks n ON s.notebook_id = n.id WHERE p.id = ? AND n.user_id = ?");
        $stmt->execute([$id, $user_id]);
        echo json_encode(["success" => true]);
    }
}
?>
