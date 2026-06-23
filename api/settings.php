<?php
require_once 'config.php';

header('Content-Type: application/json');
requireLogin();

ensureAiSettingsColumns($pdo);

$userId = (int)$_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

function getFontsConfig(): array {
    $path = __DIR__ . '/../data/fonts_config.json';
    if (file_exists($path)) {
        $data = json_decode(file_get_contents($path), true);
        if (is_array($data)) {
            return $data;
        }
    }
    return [
        [ "id" => "inter", "name" => "Inter (Default)", "family" => "Inter", "category" => "sans-serif" ],
        [ "id" => "roboto", "name" => "Roboto", "family" => "Roboto", "category" => "sans-serif" ],
        [ "id" => "lora", "name" => "Lora (Serif)", "family" => "Lora", "category" => "serif" ],
        [ "id" => "caveat", "name" => "Caveat (Handwriting)", "family" => "Caveat", "category" => "cursive" ],
        [ "id" => "jetbrains-mono", "name" => "JetBrains Mono", "family" => "JetBrains Mono", "category" => "monospace" ]
    ];
}

function saveFontsConfig(array $config): bool {
    $dir = __DIR__ . '/../data';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return file_put_contents($dir . '/fonts_config.json', json_encode($config, JSON_PRETTY_PRINT)) !== false;
}

function validateGoogleFont(string $family): bool {
    $url = 'https://fonts.googleapis.com/css2?family=' . urlencode($family);
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code === 200;
}

if ($method === 'GET') {
    $action = $_GET['action'] ?? 'ai';

    if ($action === 'ai') {
        echo json_encode(getUserAiSettings($pdo, $userId));
        exit;
    }

    if ($action === 'get_fonts') {
        echo json_encode(getFontsConfig());
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
    if ($action === 'download_fonts') {
        $fontDir = __DIR__ . '/../fonts';
        if (!is_dir($fontDir)) {
            mkdir($fontDir, 0755, true);
        }

        $fonts = getFontsConfig();
        $families = [];
        foreach ($fonts as $f) {
            $name = str_replace(' ', '+', $f['family']);
            if ($f['id'] === 'caveat') {
                $families[] = 'family=' . $name . ':wght@400..700';
            } else if ($f['id'] === 'lora') {
                $families[] = 'family=' . $name . ':ital,wght@0,400..700;1,400..700';
            } else if ($f['id'] === 'inter') {
                $families[] = 'family=' . $name . ':wght@400;500;600;700';
            } else if ($f['id'] === 'jetbrains-mono') {
                $families[] = 'family=' . $name . ':ital,wght@0,100..800;1,100..800';
            } else if ($f['id'] === 'roboto') {
                $families[] = 'family=' . $name . ':ital,wght@0,100..900;1,100..900';
            } else {
                $families[] = 'family=' . $name . ':ital,wght@0,300..700;1,300..700';
            }
        }
        $cssUrl = 'https://fonts.googleapis.com/css2?' . implode('&', $families) . '&display=swap';

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $cssUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $cssContent = curl_exec($ch);
        curl_close($ch);

        if (!$cssContent) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to fetch Google Fonts stylesheet. Check internet connection.']);
            exit;
        }

        preg_match_all('/url\((https:\/\/fonts\.gstatic\.com\/[^\)]+)\)/', $cssContent, $matches);
        $urls = array_unique($matches[1] ?? []);

        if (empty($urls)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to parse font file URLs from Google Fonts stylesheet.']);
            exit;
        }

        $downloaded = 0;
        foreach ($urls as $url) {
            $filename = basename($url);
            $localPath = $fontDir . '/' . $filename;

            if (!file_exists($localPath)) {
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                $fontData = curl_exec($ch);
                curl_close($ch);

                if ($fontData) {
                    file_put_contents($localPath, $fontData);
                    $downloaded++;
                }
            } else {
                $downloaded++;
            }

            $cssContent = str_replace($url, $filename, $cssContent);
        }

        file_put_contents($fontDir . '/local_fonts.css', $cssContent);

        echo json_encode([
            'success' => true,
            'message' => 'Successfully downloaded ' . count($fonts) . ' font families (' . count($urls) . ' font files) locally.',
        ]);
        exit;
    }

    if ($action === 'delete_fonts') {
        $fontDir = __DIR__ . '/../fonts';
        if (is_dir($fontDir)) {
            $files = glob($fontDir . '/*');
            foreach ($files as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            rmdir($fontDir);
        }
        echo json_encode(['success' => true, 'message' => 'Local fonts deleted successfully.']);
        exit;
    }

    if ($action === 'check_fonts') {
        $localCssPath = __DIR__ . '/../fonts/local_fonts.css';
        $downloaded = file_exists($localCssPath);
        echo json_encode([
            'success' => true,
            'downloaded' => $downloaded,
            'fonts' => getFontsConfig()
        ]);
        exit;
    }

    if ($action === 'add_font') {
        $family = trim($data['family'] ?? '');
        $category = trim($data['category'] ?? 'sans-serif');

        if ($family === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Font family name is required.']);
            exit;
        }

        $family = ucwords(strtolower($family));
        $id = strtolower(str_replace(' ', '-', $family));

        $fonts = getFontsConfig();
        foreach ($fonts as $f) {
            if ($f['id'] === $id) {
                http_response_code(400);
                echo json_encode(['error' => 'Font family already added.']);
                exit;
            }
        }

        if (!validateGoogleFont($family)) {
            http_response_code(400);
            echo json_encode(['error' => 'Font family "' . $family . '" was not found on Google Fonts. Please check spelling.']);
            exit;
        }

        $fonts[] = [
            'id' => $id,
            'name' => $family,
            'family' => $family,
            'category' => $category
        ];

        saveFontsConfig($fonts);

        $fontDir = __DIR__ . '/../fonts';
        if (is_dir($fontDir)) {
            $files = glob($fontDir . '/*');
            foreach ($files as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            rmdir($fontDir);
        }

        echo json_encode(['success' => true, 'fonts' => $fonts]);
        exit;
    }

    if ($action === 'delete_font') {
        $id = trim($data['id'] ?? '');

        if ($id === 'inter') {
            http_response_code(400);
            echo json_encode(['error' => 'Cannot delete the default Inter font.']);
            exit;
        }

        $fonts = getFontsConfig();
        $newFonts = [];
        $found = false;
        foreach ($fonts as $f) {
            if ($f['id'] === $id) {
                $found = true;
            } else {
                $newFonts[] = $f;
            }
        }

        if (!$found) {
            http_response_code(400);
            echo json_encode(['error' => 'Font family not found.']);
            exit;
        }

        saveFontsConfig($newFonts);

        $fontDir = __DIR__ . '/../fonts';
        if (is_dir($fontDir)) {
            $files = glob($fontDir . '/*');
            foreach ($files as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            rmdir($fontDir);
        }

        echo json_encode(['success' => true, 'fonts' => $newFonts]);
        exit;
    }

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
