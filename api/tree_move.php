<?php
require_once 'config.php';
requireLogin();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

ensureSortOrderColumns($pdo);
backfillSortOrders($pdo);

$userId = (int)$_SESSION['user_id'];
$data = json_decode(file_get_contents('php://input'), true) ?: [];

$type = $data['type'] ?? null;
$id = isset($data['id']) ? (int)$data['id'] : 0;
$targetType = $data['target_type'] ?? null;
$targetId = isset($data['target_id']) ? (int)$data['target_id'] : 0;
$position = $data['position'] ?? null;

if (!$type || !$id || !$targetType || !$targetId || !$position) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

if ($id === $targetId && $type === $targetType) {
    http_response_code(400);
    echo json_encode(['error' => 'Cannot move item onto itself']);
    exit;
}

function applySortOrder(PDO $pdo, string $table, array $ids): void {
    foreach ($ids as $index => $itemId) {
        $sortOrder = ($index + 1) * 10;
        $stmt = $pdo->prepare("UPDATE {$table} SET sort_order = ? WHERE id = ?");
        $stmt->execute([$sortOrder, $itemId]);
    }
}

function getOrderedNotebookIds(PDO $pdo, int $userId): array {
    $stmt = $pdo->prepare('SELECT id FROM notebooks WHERE user_id = ? ORDER BY sort_order ASC, id ASC');
    $stmt->execute([$userId]);
    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function getOrderedSectionIds(PDO $pdo, int $notebookId): array {
    $stmt = $pdo->prepare('SELECT id FROM sections WHERE notebook_id = ? ORDER BY sort_order ASC, id ASC');
    $stmt->execute([$notebookId]);
    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function getOrderedPageIds(PDO $pdo, int $sectionId): array {
    $stmt = $pdo->prepare('SELECT id FROM pages WHERE section_id = ? ORDER BY sort_order ASC, id ASC');
    $stmt->execute([$sectionId]);
    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function insertRelative(array $ids, int $movingId, int $targetId, string $position): array {
    $ids = array_values(array_filter($ids, static fn($itemId) => (int)$itemId !== $movingId));
    $index = array_search($targetId, $ids, true);
    if ($index === false) {
        throw new RuntimeException('Target not found in sibling list');
    }

    if ($position === 'before') {
        array_splice($ids, $index, 0, [$movingId]);
    } elseif ($position === 'after') {
        array_splice($ids, $index + 1, 0, [$movingId]);
    } else {
        throw new RuntimeException('Invalid relative position');
    }

    return $ids;
}

function appendToList(array $ids, int $movingId): array {
    $ids = array_values(array_filter($ids, static fn($itemId) => (int)$itemId !== $movingId));
    $ids[] = $movingId;
    return $ids;
}

function verifyNotebook(PDO $pdo, int $notebookId, int $userId): bool {
    $stmt = $pdo->prepare('SELECT id FROM notebooks WHERE id = ? AND user_id = ?');
    $stmt->execute([$notebookId, $userId]);
    return (bool)$stmt->fetch();
}

function fetchSection(PDO $pdo, int $sectionId, int $userId): ?array {
    $stmt = $pdo->prepare('
        SELECT s.id, s.notebook_id
        FROM sections s
        JOIN notebooks n ON s.notebook_id = n.id
        WHERE s.id = ? AND n.user_id = ?
    ');
    $stmt->execute([$sectionId, $userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function fetchPage(PDO $pdo, int $pageId, int $userId): ?array {
    $stmt = $pdo->prepare('
        SELECT p.id, p.section_id
        FROM pages p
        JOIN sections s ON p.section_id = s.id
        JOIN notebooks n ON s.notebook_id = n.id
        WHERE p.id = ? AND n.user_id = ?
    ');
    $stmt->execute([$pageId, $userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

try {
    $pdo->beginTransaction();

    $response = ['success' => true];

    if ($type === 'notebook') {
        if ($targetType !== 'notebook' || !in_array($position, ['before', 'after'], true)) {
            throw new RuntimeException('Invalid notebook move');
        }
        if (!verifyNotebook($pdo, $id, $userId) || !verifyNotebook($pdo, $targetId, $userId)) {
            throw new RuntimeException('Notebook not found');
        }

        $orderedIds = getOrderedNotebookIds($pdo, $userId);
        $orderedIds = insertRelative($orderedIds, $id, $targetId, $position);
        applySortOrder($pdo, 'notebooks', $orderedIds);
        $response['affected_notebook_ids'] = array_values(array_unique($orderedIds));
    } elseif ($type === 'section') {
        $section = fetchSection($pdo, $id, $userId);
        if (!$section) {
            throw new RuntimeException('Section not found');
        }

        $oldNotebookId = (int)$section['notebook_id'];
        $affectedNotebookIds = [$oldNotebookId];

        if ($targetType === 'notebook' && $position === 'inside') {
            if (!verifyNotebook($pdo, $targetId, $userId)) {
                throw new RuntimeException('Target folder not found');
            }

            $oldIds = getOrderedSectionIds($pdo, $oldNotebookId);
            $oldIds = array_values(array_filter($oldIds, static fn($itemId) => $itemId !== $id));
            applySortOrder($pdo, 'sections', $oldIds);

            $stmt = $pdo->prepare('UPDATE sections SET notebook_id = ? WHERE id = ?');
            $stmt->execute([$targetId, $id]);

            $newIds = appendToList(getOrderedSectionIds($pdo, $targetId), $id);
            applySortOrder($pdo, 'sections', $newIds);

            $affectedNotebookIds[] = (int)$targetId;
            $response['new_notebook_id'] = (int)$targetId;
        } elseif ($targetType === 'section' && in_array($position, ['before', 'after'], true)) {
            $targetSection = fetchSection($pdo, $targetId, $userId);
            if (!$targetSection) {
                throw new RuntimeException('Target subfolder not found');
            }

            $newNotebookId = (int)$targetSection['notebook_id'];
            if ($newNotebookId !== $oldNotebookId) {
                $oldIds = getOrderedSectionIds($pdo, $oldNotebookId);
                $oldIds = array_values(array_filter($oldIds, static fn($itemId) => $itemId !== $id));
                applySortOrder($pdo, 'sections', $oldIds);

                $stmt = $pdo->prepare('UPDATE sections SET notebook_id = ? WHERE id = ?');
                $stmt->execute([$newNotebookId, $id]);
                $affectedNotebookIds[] = $newNotebookId;
                $response['new_notebook_id'] = $newNotebookId;
            }

            $orderedIds = getOrderedSectionIds($pdo, $newNotebookId);
            $orderedIds = insertRelative($orderedIds, $id, $targetId, $position);
            applySortOrder($pdo, 'sections', $orderedIds);
        } else {
            throw new RuntimeException('Invalid section move');
        }

        $response['affected_notebook_ids'] = array_values(array_unique($affectedNotebookIds));
        $response['affected_section_ids'] = [$id];
    } elseif ($type === 'page') {
        $page = fetchPage($pdo, $id, $userId);
        if (!$page) {
            throw new RuntimeException('Note not found');
        }

        $oldSectionId = (int)$page['section_id'];
        $affectedSectionIds = [$oldSectionId];

        if ($targetType === 'section' && $position === 'inside') {
            $targetSection = fetchSection($pdo, $targetId, $userId);
            if (!$targetSection) {
                throw new RuntimeException('Target subfolder not found');
            }

            $oldIds = getOrderedPageIds($pdo, $oldSectionId);
            $oldIds = array_values(array_filter($oldIds, static fn($itemId) => $itemId !== $id));
            applySortOrder($pdo, 'pages', $oldIds);

            $stmt = $pdo->prepare('UPDATE pages SET section_id = ? WHERE id = ?');
            $stmt->execute([$targetId, $id]);

            $newIds = appendToList(getOrderedPageIds($pdo, $targetId), $id);
            applySortOrder($pdo, 'pages', $newIds);

            $affectedSectionIds[] = (int)$targetId;
            $response['new_section_id'] = (int)$targetId;
        } elseif ($targetType === 'page' && in_array($position, ['before', 'after'], true)) {
            $targetPage = fetchPage($pdo, $targetId, $userId);
            if (!$targetPage) {
                throw new RuntimeException('Target note not found');
            }

            $newSectionId = (int)$targetPage['section_id'];
            if ($newSectionId !== $oldSectionId) {
                $oldIds = getOrderedPageIds($pdo, $oldSectionId);
                $oldIds = array_values(array_filter($oldIds, static fn($itemId) => $itemId !== $id));
                applySortOrder($pdo, 'pages', $oldIds);

                $stmt = $pdo->prepare('UPDATE pages SET section_id = ? WHERE id = ?');
                $stmt->execute([$newSectionId, $id]);
                $affectedSectionIds[] = $newSectionId;
                $response['new_section_id'] = $newSectionId;
            }

            $orderedIds = getOrderedPageIds($pdo, $newSectionId);
            $orderedIds = insertRelative($orderedIds, $id, $targetId, $position);
            applySortOrder($pdo, 'pages', $orderedIds);
        } else {
            throw new RuntimeException('Invalid note move');
        }

        $response['affected_section_ids'] = array_values(array_unique($affectedSectionIds));
    } else {
        throw new RuntimeException('Invalid item type');
    }

    $pdo->commit();
    echo json_encode($response);
} catch (RuntimeException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Move failed']);
}
