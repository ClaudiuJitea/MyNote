<?php

function openrouterRequest(string $apiKey, string $payload): array {
    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
        'HTTP-Referer: https://mynote.local',
        'X-Title: MyNotes',
    ];

    if (function_exists('curl_init')) {
        $ch = curl_init('https://openrouter.ai/api/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_TIMEOUT => 120,
        ]);

        $responseBody = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($responseBody === false) {
            throw new RuntimeException('OpenRouter request failed: ' . $curlError);
        }

        return [
            'status' => $statusCode,
            'body' => $responseBody,
        ];
    }

    if (!ini_get('allow_url_fopen')) {
        throw new RuntimeException('OpenRouter requests require the PHP cURL extension or allow_url_fopen enabled.');
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $payload,
            'timeout' => 120,
            'ignore_errors' => true,
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);

    $responseBody = @file_get_contents('https://openrouter.ai/api/v1/chat/completions', false, $context);
    if ($responseBody === false) {
        $error = error_get_last();
        throw new RuntimeException('OpenRouter request failed: ' . ($error['message'] ?? 'Network error'));
    }

    $statusCode = 200;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches)) {
        $statusCode = (int)$matches[1];
    }

    return [
        'status' => $statusCode,
        'body' => $responseBody,
    ];
}

function openrouterChat(
    string $apiKey,
    string $model,
    array $messages,
    float $temperature = 0.7,
    int $maxTokens = 2048
): string {
    $payload = json_encode([
        'model' => $model,
        'messages' => $messages,
        'temperature' => $temperature,
        'max_tokens' => $maxTokens,
    ]);

    $response = openrouterRequest($apiKey, $payload);
    $statusCode = $response['status'];
    $responseBody = $response['body'];

    $decoded = json_decode($responseBody, true);
    if ($statusCode >= 400) {
        $message = $decoded['error']['message'] ?? $decoded['error'] ?? ('HTTP ' . $statusCode);
        if (is_array($message)) {
            $message = json_encode($message);
        }
        throw new RuntimeException((string)$message);
    }

    $content = $decoded['choices'][0]['message']['content'] ?? null;
    if (!is_string($content) || trim($content) === '') {
        throw new RuntimeException('OpenRouter returned an empty response.');
    }

    return trim($content);
}

function stripHtmlToPlainText(string $html): string {
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace("/[ \t]+\n/", "\n", $text);
    $text = preg_replace("/\n{3,}/", "\n\n", $text);
    return trim((string)$text);
}

function getAiActionConfig(string $action): array {
    $configs = [
        'improve' => ['temperature' => 0.6, 'max_tokens' => 2048, 'requires_text' => true],
        'grammar' => ['temperature' => 0.2, 'max_tokens' => 2048, 'requires_text' => true],
        'shorter' => ['temperature' => 0.5, 'max_tokens' => 1536, 'requires_text' => true],
        'expand' => ['temperature' => 0.7, 'max_tokens' => 3072, 'requires_text' => true],
        'formal' => ['temperature' => 0.5, 'max_tokens' => 2048, 'requires_text' => true],
        'casual' => ['temperature' => 0.6, 'max_tokens' => 2048, 'requires_text' => true],
        'summarize' => ['temperature' => 0.4, 'max_tokens' => 768, 'requires_text' => true, 'uses_title' => true],
        'key_points' => ['temperature' => 0.4, 'max_tokens' => 1024, 'requires_text' => true, 'uses_title' => true],
        'outline' => ['temperature' => 0.5, 'max_tokens' => 1536, 'requires_text' => true, 'uses_title' => true],
        'explain' => ['temperature' => 0.5, 'max_tokens' => 2048, 'requires_text' => true, 'uses_title' => true],
        'keywords' => ['temperature' => 0.3, 'max_tokens' => 256, 'requires_text' => true, 'uses_title' => true],
        'translate' => ['temperature' => 0.3, 'max_tokens' => 3072, 'requires_text' => true, 'needs_language' => true],
        'continue' => ['temperature' => 0.75, 'max_tokens' => 2048, 'requires_text' => true, 'uses_title' => true],
        'generate' => ['temperature' => 0.75, 'max_tokens' => 3072, 'requires_text' => false, 'needs_topic' => true],
        'brainstorm' => ['temperature' => 0.85, 'max_tokens' => 1536, 'requires_text' => false, 'needs_topic' => true],
        'flashcards' => ['temperature' => 0.5, 'max_tokens' => 2048, 'requires_text' => true, 'uses_title' => true],
        'quiz' => ['temperature' => 0.55, 'max_tokens' => 2048, 'requires_text' => true, 'uses_title' => true],
        'memorize' => ['temperature' => 0.6, 'max_tokens' => 1536, 'requires_text' => true, 'uses_title' => true],
        'study_plan' => ['temperature' => 0.55, 'max_tokens' => 2048, 'requires_text' => true, 'uses_title' => true],
        'actions' => ['temperature' => 0.4, 'max_tokens' => 1024, 'requires_text' => true, 'uses_title' => true],
        'title' => ['temperature' => 0.5, 'max_tokens' => 64, 'requires_text' => true, 'uses_title' => true, 'apply_target' => 'title'],
        'ask' => ['temperature' => 0.4, 'max_tokens' => 1536, 'requires_text' => true, 'uses_title' => true, 'needs_question' => true],
        'summarize_section' => ['temperature' => 0.4, 'max_tokens' => 1536, 'requires_text' => false, 'uses_scope' => 'section'],
        'summarize_notebook' => ['temperature' => 0.4, 'max_tokens' => 2048, 'requires_text' => false, 'uses_scope' => 'notebook'],
        'custom' => ['temperature' => 0.7, 'max_tokens' => 3072, 'requires_text' => false, 'needs_custom_prompt' => true],
    ];

    if (!isset($configs[$action])) {
        throw new InvalidArgumentException('Unknown AI action.');
    }

    return $configs[$action];
}

function buildAiMessages(string $action, string $text, ?string $customPrompt = null, array $options = []): array {
    $targetLang = trim((string)($options['target_lang'] ?? 'English'));
    $topic = trim((string)($options['topic'] ?? ''));
    $question = trim((string)($options['question'] ?? ''));
    $scopeLabel = trim((string)($options['scope_label'] ?? ''));

    $prompts = [
        'improve' => 'Improve the following note text for clarity and readability. Preserve the meaning, tone, and formatting (like headings and lists). Return only the improved text without commentary.',
        'grammar' => 'Fix grammar, spelling, and punctuation in the following text. Preserve headings and list formatting. Return only the corrected text without commentary.',
        'shorter' => 'Make the following text shorter while keeping the key points. Return only the shortened text without commentary.',
        'expand' => 'Expand and elaborate on the following note text with useful details, examples, and context where appropriate. Keep the same topic. Use Markdown headings (## and ###) to structure the expanded section. Return only the expanded text without commentary.',
        'formal' => 'Rewrite the following text in a professional, formal tone. Preserve structure and headings. Return only the rewritten text without commentary.',
        'casual' => 'Rewrite the following text in a friendly, conversational tone. Preserve structure and headings. Return only the rewritten text without commentary.',
        'summarize' => 'Summarize the following note text in concise prose. Return only the summary without commentary.',
        'key_points' => 'Extract the most important key points from the following note. Return a clear bullet list (use "- " for each item). Return only the list without commentary.',
        'outline' => 'Create a structured outline of the following note. Use Markdown headings (## for main sections, ### for subsections) and bullet points. Return only the outline without commentary.',
        'explain' => 'Explain the following note in simple, easy-to-understand language. Use Markdown headings (## and ###) to structure your explanation clearly. Return only the explanation without commentary.',
        'keywords' => 'Extract 5–12 relevant keywords or tags from the following note. Return them as a comma-separated list only, without commentary.',
        'translate' => 'Translate the following text into ' . $targetLang . '. Preserve the exact headings, list formats, and tone. Return only the translated text without commentary.',
        'continue' => 'Continue writing naturally from the following note text. Match the style and topic. Use Markdown headings (## and ###) if starting new sections. Return only the continuation without commentary.',
        'generate' => 'Write a well-structured note about the following topic. Use clear Markdown headings (# for the main title, ## for sections, ### for subsections), paragraphs, and bullet lists to make the content highly structured. Return only the note content without commentary.',
        'brainstorm' => 'Brainstorm creative ideas, angles, and talking points related to the following topic. Use Markdown headings (## and ###) to categorize the brainstorming list where helpful. Return only the ideas without commentary.',
        'flashcards' => 'Create study flashcards from the following note. Format each card as "Q: ..." on one line and "A: ..." on the next line, with a blank line between cards. Create at least 5 cards. Return only the flashcards without commentary.',
        'quiz' => 'Create a short study quiz from the following note with 5–8 questions. Use Markdown headings (## for questions, ## for Answer key) to structure the quiz. Return only the quiz without commentary.',
        'memorize' => 'Suggest practical memory techniques, mnemonics, and recall strategies to help memorize the following material. Use headings to organize suggestions. Return only the tips without commentary.',
        'study_plan' => 'Create a practical study plan to learn and retain the material in the following note. Use Markdown headings (## for phases/weeks, ### for study topics) to structure the schedule. Return only the plan without commentary.',
        'actions' => 'Extract actionable to-do items from the following note. Return a checklist using "- [ ] " for each item. Return only the checklist without commentary.',
        'title' => 'Suggest a concise, descriptive title for the following note. Return only the title text on a single line, without quotes or commentary.',
        'ask' => 'Answer the user question using only information from the note below. Use Markdown headings and paragraphs if formatting is helpful for structured answers. Return only the answer without commentary.',
        'summarize_section' => 'Summarize the collection of notes below from the subfolder "' . $scopeLabel . '". Use Markdown headings (## for individual notes or themes) to structure the summary. Return only the summary without commentary.',
        'summarize_notebook' => 'Summarize the collection of notes below from the folder "' . $scopeLabel . '". Use Markdown headings (## for subfolders/sections) to structure the summary. Return only the summary without commentary.',
    ];

    if ($action === 'custom') {
        $instruction = trim((string)$customPrompt);
        if ($instruction === '') {
            throw new InvalidArgumentException('Custom instructions are required.');
        }
        $system = $instruction . ' Return only the result without commentary.';
        if ($text !== '') {
            $userContent = $text;
        } elseif ($topic !== '') {
            $userContent = $topic;
        } else {
            $userContent = 'Generate the note content now.';
        }
    } else {
        if (!isset($prompts[$action])) {
            throw new InvalidArgumentException('Unknown AI action.');
        }
        $system = $prompts[$action];

        if (in_array($action, ['generate', 'brainstorm'], true)) {
            if ($topic === '') {
                throw new InvalidArgumentException('A topic is required for this action.');
            }
            $userContent = $topic;
            if ($text !== '') {
                $userContent = "Topic: {$topic}\n\nReference material:\n{$text}";
            }
        } elseif ($action === 'ask') {
            if ($question === '') {
                throw new InvalidArgumentException('A question is required for this action.');
            }
            $userContent = "Question: {$question}\n\nNote:\n{$text}";
        } elseif (in_array($action, ['summarize_section', 'summarize_notebook'], true)) {
            if ($text === '') {
                throw new InvalidArgumentException('No notes found to summarize in this folder.');
            }
            $userContent = $text;
        } else {
            if ($text === '') {
                throw new InvalidArgumentException('No text provided for AI processing.');
            }
            $userContent = $text;
        }
    }

    return [
        ['role' => 'system', 'content' => $system],
        ['role' => 'user', 'content' => $userContent],
    ];
}

function fetchScopedNoteText(PDO $pdo, int $userId, string $scopeType, int $scopeId): array {
    if ($scopeType === 'section') {
        $stmt = $pdo->prepare("
            SELECT s.name AS scope_label, p.title, p.content
            FROM pages p
            JOIN sections s ON p.section_id = s.id
            JOIN notebooks n ON s.notebook_id = n.id
            WHERE s.id = ? AND n.user_id = ?
            ORDER BY p.sort_order ASC, p.id ASC
        ");
        $stmt->execute([$scopeId, $userId]);
    } elseif ($scopeType === 'notebook') {
        $stmt = $pdo->prepare("
            SELECT n.name AS scope_label, s.name AS section_name, p.title, p.content
            FROM pages p
            JOIN sections s ON p.section_id = s.id
            JOIN notebooks n ON s.notebook_id = n.id
            WHERE n.id = ? AND n.user_id = ?
            ORDER BY s.sort_order ASC, s.id ASC, p.sort_order ASC, p.id ASC
        ");
        $stmt->execute([$scopeId, $userId]);
    } else {
        throw new InvalidArgumentException('Invalid scope type.');
    }

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$rows) {
        return ['text' => '', 'scope_label' => ''];
    }

    $scopeLabel = (string)($rows[0]['scope_label'] ?? '');
    $parts = [];

    foreach ($rows as $row) {
        $plain = stripHtmlToPlainText((string)($row['content'] ?? ''));
        if ($plain === '') {
            continue;
        }

        $heading = trim((string)($row['title'] ?? 'Untitled'));
        if ($scopeType === 'notebook' && !empty($row['section_name'])) {
            $heading = trim((string)$row['section_name']) . ' / ' . $heading;
        }

        $parts[] = "## {$heading}\n{$plain}";
    }

    return [
        'text' => implode("\n\n", $parts),
        'scope_label' => $scopeLabel,
    ];
}
