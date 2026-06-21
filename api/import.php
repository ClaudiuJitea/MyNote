<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/archive.php';
requireLogin();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$scope = $_POST['scope'] ?? 'user';
$mode = $_POST['mode'] ?? 'merge';

if ($scope === 'system') {
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden: Admins only']);
        exit;
    }
}

if (!isset($_FILES['archive']) || $_FILES['archive']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No archive file uploaded']);
    exit;
}

$upload = $_FILES['archive'];
$name = strtolower($upload['name'] ?? '');
if (!str_ends_with($name, '.zip') && !str_ends_with($name, '.mynote.zip')) {
    http_response_code(400);
    echo json_encode(['error' => 'File must be a .zip or .mynote.zip archive']);
    exit;
}

$finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : null;
if ($finfo) {
    $mime = finfo_file($finfo, $upload['tmp_name']);
    finfo_close($finfo);
    $allowed = ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip', 'application/octet-stream'];
    if (!in_array($mime, $allowed, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid file type']);
        exit;
    }
}

try {
    $summary = mynote_import_from_upload(
        $pdo,
        $upload['tmp_name'],
        $mode,
        $scope,
        (int)$_SESSION['user_id']
    );
    echo json_encode(['success' => true, 'summary' => $summary]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
