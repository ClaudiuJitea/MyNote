<?php
require_once 'config.php';
requireLogin();

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if (!function_exists('search_strlen')) {
    function search_strlen(string $s): int {
        if (function_exists('mb_strlen')) {
            return mb_strlen($s, 'UTF-8');
        }
        return (int)preg_match_all('/./us', $s);
    }

    function search_substr(string $s, int $start, ?int $length = null): string {
        if (function_exists('mb_substr')) {
            return $length === null
                ? mb_substr($s, $start, null, 'UTF-8')
                : mb_substr($s, $start, $length, 'UTF-8');
        }
        preg_match_all('/./us', $s, $matches);
        $chars = array_slice($matches[0], $start, $length ?? PHP_INT_MAX);
        return implode('', $chars);
    }

    function search_stripos(string $haystack, string $needle, int $offset = 0) {
        if ($needle === '') {
            return false;
        }
        if (function_exists('mb_stripos')) {
            return mb_stripos($haystack, $needle, $offset, 'UTF-8');
        }
        $sub = search_substr($haystack, $offset);
        if ($sub === '') {
            return false;
        }
        if (!preg_match('/(' . preg_quote($needle, '/') . ')/iu', $sub, $m, PREG_OFFSET_CAPTURE)) {
            return false;
        }
        $before = substr($sub, 0, $m[0][1]);
        return $offset + (int)preg_match_all('/./us', $before);
    }
}

$query = trim($_GET['q'] ?? '');
$user_id = $_SESSION['user_id'];

if (search_strlen($query) < 2) {
    echo json_encode(['query' => $query, 'findings' => [], 'total' => 0]);
    exit;
}

function normalizeSearchText($html) {
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return preg_replace('/\s+/u', ' ', trim($text));
}

function extractSnippet($text, $query, $radius = 72) {
    $plain = normalizeSearchText($text);
    if ($plain === '') {
        return '';
    }

    $pos = search_stripos($plain, $query);
    if ($pos === false) {
        return search_substr($plain, 0, min(140, search_strlen($plain)));
    }

    $start = max(0, $pos - $radius);
    $snippet = search_substr($plain, $start, search_strlen($query) + ($radius * 2));

    if ($start > 0) {
        $snippet = '…' . ltrim($snippet);
    }
    if ($start + search_strlen($query) + ($radius * 2) < search_strlen($plain)) {
        $snippet = rtrim($snippet) . '…';
    }

    return $snippet;
}

try {
    $searchTerm = '%' . $query . '%';
    $findings = [];

    $baseSelect = "
        SELECT p.id AS page_id, p.title, p.content, p.updated_at,
               n.name AS notebook_name, s.name AS section_name
        FROM pages p
        JOIN sections s ON p.section_id = s.id
        JOIN notebooks n ON s.notebook_id = n.id
        WHERE n.user_id = ?
    ";

    $stmt = $pdo->prepare($baseSelect . " AND p.title LIKE ? ORDER BY p.updated_at DESC LIMIT 25");
    $stmt->execute([$user_id, $searchTerm]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $findings[] = [
            'page_id' => (int)$row['page_id'],
            'title' => $row['title'],
            'notebook_name' => $row['notebook_name'],
            'section_name' => $row['section_name'],
            'match_type' => 'title',
            'snippet' => $row['title'],
            'updated_at' => $row['updated_at'],
        ];
    }

    $stmt = $pdo->prepare($baseSelect . " AND p.content LIKE ? ORDER BY p.updated_at DESC LIMIT 40");
    $stmt->execute([$user_id, $searchTerm]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $snippet = extractSnippet($row['content'], $query);
        if ($snippet === '') {
            continue;
        }

        $findings[] = [
            'page_id' => (int)$row['page_id'],
            'title' => $row['title'],
            'notebook_name' => $row['notebook_name'],
            'section_name' => $row['section_name'],
            'match_type' => 'content',
            'snippet' => $snippet,
            'updated_at' => $row['updated_at'],
        ];
    }

    $sqlImg = "
        SELECT pi.page_id, p.title, pi.image_url, pi.ocr_text, p.updated_at,
               n.name AS notebook_name, s.name AS section_name
        FROM page_images pi
        JOIN pages p ON pi.page_id = p.id
        JOIN sections s ON p.section_id = s.id
        JOIN notebooks n ON s.notebook_id = n.id
        WHERE n.user_id = ? AND pi.ocr_text LIKE ?
        ORDER BY p.updated_at DESC
        LIMIT 15
    ";
    try {
        $stmtImg = $pdo->prepare($sqlImg);
        $stmtImg->execute([$user_id, $searchTerm]);
        foreach ($stmtImg->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $findings[] = [
                'page_id' => (int)$row['page_id'],
                'title' => $row['title'],
                'notebook_name' => $row['notebook_name'],
                'section_name' => $row['section_name'],
                'match_type' => 'image',
                'snippet' => extractSnippet($row['ocr_text'] ?? '', $query),
                'image_url' => $row['image_url'],
                'updated_at' => $row['updated_at'],
            ];
        }
    } catch (PDOException $e) {
        // page_images table may not exist on older installs
    }

    $matchOrder = ['title' => 0, 'content' => 1, 'image' => 2];
    usort($findings, function ($a, $b) use ($matchOrder) {
        $typeCmp = ($matchOrder[$a['match_type']] ?? 9) <=> ($matchOrder[$b['match_type']] ?? 9);
        if ($typeCmp !== 0) {
            return $typeCmp;
        }
        return strcmp($b['updated_at'] ?? '', $a['updated_at'] ?? '');
    });

    $findings = array_slice($findings, 0, 30);

    echo json_encode([
        'query' => $query,
        'findings' => $findings,
        'total' => count($findings),
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Search failed', 'findings' => [], 'total' => 0]);
}
