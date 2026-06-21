<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/archive.php';
requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$scope = $_GET['scope'] ?? 'user';

try {
    if ($scope === 'system') {
        if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Forbidden: Admins only']);
            exit;
        }
        $manifest = mynote_build_system_export($pdo);
        $filename = 'mynote-system-backup-' . gmdate('Y-m-d') . '.mynote.zip';
    } elseif ($scope === 'user') {
        $manifest = mynote_build_user_export($pdo, (int)$_SESSION['user_id']);
        $filename = 'mynote-backup-' . gmdate('Y-m-d') . '.mynote.zip';
    } else {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid scope']);
        exit;
    }

    $zipPath = mynote_create_zip_from_manifest($manifest);

    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . filesize($zipPath));
    header('Cache-Control: no-store');

    readfile($zipPath);
    @unlink($zipPath);
} catch (Throwable $e) {
    error_log('Export failed: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Export failed. Please try again later.']);
}
