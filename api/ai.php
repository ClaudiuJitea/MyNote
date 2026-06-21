<?php
require_once 'config.php';
require_once __DIR__ . '/lib/openrouter.php';

header('Content-Type: application/json');
requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true) ?: [];
$action = trim((string)($data['action'] ?? ''));
$text = trim((string)($data['text'] ?? ''));
$customPrompt = trim((string)($data['prompt'] ?? ''));
$title = trim((string)($data['title'] ?? ''));
$targetLang = trim((string)($data['target_lang'] ?? 'English'));
$topic = trim((string)($data['topic'] ?? ''));
$question = trim((string)($data['question'] ?? ''));
$scopeId = isset($data['scope_id']) ? (int)$data['scope_id'] : 0;

if ($action === '') {
    http_response_code(400);
    echo json_encode(['error' => 'AI action is required.']);
    exit;
}

$credentials = getUserOpenRouterCredentials($pdo, (int)$_SESSION['user_id']);
if (!$credentials) {
    http_response_code(400);
    echo json_encode([
        'error' => 'OpenRouter API key not configured. Add your key in Account settings.',
        'needs_settings' => true,
    ]);
    exit;
}

try {
    $config = getAiActionConfig($action);
    $options = [
        'target_lang' => $targetLang !== '' ? $targetLang : 'English',
        'topic' => $topic,
        'question' => $question,
    ];

    if (!empty($config['uses_scope'])) {
        if ($scopeId <= 0) {
            throw new InvalidArgumentException('Select a folder scope for this action.');
        }
        $scopeType = $config['uses_scope'];
        $scoped = fetchScopedNoteText($pdo, (int)$_SESSION['user_id'], $scopeType, $scopeId);
        $text = $scoped['text'];
        $options['scope_label'] = $scoped['scope_label'];
    }

    if (!empty($config['requires_text']) && $text === '' && empty($config['needs_topic'])) {
        http_response_code(400);
        echo json_encode(['error' => 'No text provided for AI processing.']);
        exit;
    }

    $messages = buildAiMessages($action, $text, $customPrompt, $options);

    if ($title !== '' && !empty($config['uses_title'])) {
        array_unshift($messages, [
            'role' => 'system',
            'content' => 'Note title: ' . $title,
        ]);
    }

    $result = openrouterChat(
        $credentials['api_key'],
        $credentials['model'],
        $messages,
        (float)$config['temperature'],
        (int)$config['max_tokens']
    );

    echo json_encode([
        'success' => true,
        'result' => $result,
        'model' => $credentials['model'],
        'action' => $action,
        'apply_target' => $config['apply_target'] ?? 'content',
    ]);
} catch (InvalidArgumentException $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log('AI request failed: ' . $e->getMessage());
    http_response_code(502);
    echo json_encode(['error' => 'AI request failed. Please try again later.']);
}
