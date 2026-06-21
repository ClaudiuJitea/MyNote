<?php
require_once 'config.php';

header('Content-Type: application/json');
requireLogin();

ensureAiSettingsColumns($pdo);

$userId = (int)$_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = $_GET['action'] ?? 'ai';

    if ($action === 'ai') {
        echo json_encode(getUserAiSettings($pdo, $userId));
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Unknown action']);
    exit;
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
    $settings = getUserAiSettings($pdo, $userId);
    $modelInput = trim((string)($data['model'] ?? $settings['model']));
    $model = normalizeOpenRouterModel($modelInput);

    if (!$model) {
        http_response_code(400);
        echo json_encode(['error' => 'Enter a valid OpenRouter model ID (e.g. google/gemma-4-26b-a4b-it).']);
        exit;
    }

    $apiKeyProvided = array_key_exists('api_key', $data);
    $apiKey = trim((string)($data['api_key'] ?? ''));

    if ($apiKeyProvided && $apiKey !== '') {
        if (strlen($apiKey) < 12) {
            http_response_code(400);
            echo json_encode(['error' => 'API key looks too short. Check your OpenRouter key.']);
            exit;
        }

        $encrypted = encryptSetting($apiKey);
        $stmt = $pdo->prepare('UPDATE users SET openrouter_api_key = ?, openrouter_model = ? WHERE id = ?');
        $stmt->execute([$encrypted, $model, $userId]);
    } else {
        $stmt = $pdo->prepare('UPDATE users SET openrouter_model = ? WHERE id = ?');
        $stmt->execute([$model, $userId]);
    }

    echo json_encode([
        'success' => true,
        'settings' => getUserAiSettings($pdo, $userId),
    ]);
    exit;
}

if ($method === 'DELETE') {
    $stmt = $pdo->prepare('UPDATE users SET openrouter_api_key = NULL WHERE id = ?');
    $stmt->execute([$userId]);

    echo json_encode([
        'success' => true,
        'settings' => getUserAiSettings($pdo, $userId),
    ]);
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $data['action'] ?? '';

    if ($action !== 'test') {
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
        exit;
    }

    $credentials = getUserOpenRouterCredentials($pdo, $userId);
    if (!$credentials) {
        http_response_code(400);
        echo json_encode(['error' => 'Add and save your OpenRouter API key first.']);
        exit;
    }

    require_once __DIR__ . '/lib/openrouter.php';

    try {
        $reply = openrouterChat(
            $credentials['api_key'],
            $credentials['model'],
            [
                ['role' => 'user', 'content' => 'Reply with exactly: Connection successful.'],
            ],
            0.2,
            32
        );

        echo json_encode([
            'success' => true,
            'message' => trim($reply) ?: 'Connection successful.',
            'model' => $credentials['model'],
        ]);
    } catch (Throwable $e) {
        http_response_code(502);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
