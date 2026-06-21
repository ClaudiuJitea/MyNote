<?php

const MYNOTE_FORMAT = 'mynote-archive';
const MYNOTE_VERSION = 1;
const MYNOTE_MAX_ZIP_ENTRIES = 10000;
const MYNOTE_MAX_UNCOMPRESSED_BYTES = 209715200; // 200 MB

function mynote_project_root(): string {
    return realpath(__DIR__ . '/../..');
}

function mynote_generate_export_id(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf(
        '%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12)
    );
}

function mynote_normalize_asset_url(?string $url): ?string {
    if ($url === null || $url === '') {
        return null;
    }
    $url = html_entity_decode(trim($url), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $url = preg_replace('#^\./+#', '', $url);
    $url = preg_replace('#^/+#', '', $url);
    if (preg_match('#^https?://#i', $url)) {
        return null;
    }
    if (strpos($url, 'uploads/') === 0) {
        return $url;
    }
    if (strpos($url, '../uploads/') === 0) {
        return substr($url, 3);
    }
    return null;
}

function mynote_collect_asset_urls_from_content(?string $html): array {
    if ($html === null || $html === '') {
        return [];
    }
    $urls = [];
    if (preg_match_all('/src=["\']([^"\']+)["\']/i', $html, $matches)) {
        foreach ($matches[1] as $url) {
            $normalized = mynote_normalize_asset_url($url);
            if ($normalized) {
                $urls[$normalized] = true;
            }
        }
    }
    return array_keys($urls);
}

class MyNoteAssetRegistry {
    private string $projectRoot;
    /** @var array<string, array{path:string,full_path:string,original_url:string,sha256:string}> */
    private array $byHash = [];
    /** @var array<string, string> */
    private array $urlToArchive = [];

    public function __construct(?string $projectRoot = null) {
        $this->projectRoot = $projectRoot ?: mynote_project_root();
    }

    public function registerUrl(?string $url): ?string {
        $normalized = mynote_normalize_asset_url($url);
        if (!$normalized) {
            return null;
        }
        if (isset($this->urlToArchive[$normalized])) {
            return $this->urlToArchive[$normalized];
        }

        $fullPath = $this->projectRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $normalized);
        if (!is_file($fullPath)) {
            return null;
        }

        $hash = hash_file('sha256', $fullPath);
        if (!isset($this->byHash[$hash])) {
            $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION) ?: 'bin');
            $archivePath = 'assets/' . substr($hash, 0, 16) . '.' . $ext;
            $this->byHash[$hash] = [
                'path' => $archivePath,
                'full_path' => $fullPath,
                'original_url' => $normalized,
                'sha256' => $hash,
            ];
        }

        $archivePath = $this->byHash[$hash]['path'];
        $this->urlToArchive[$normalized] = $archivePath;
        return $archivePath;
    }

    public function rewriteContent(?string $html): string {
        if ($html === null || $html === '') {
            return '';
        }
        return preg_replace_callback('/src=(["\'])([^"\']+)\1/i', function ($matches) {
            $archivePath = $this->registerUrl($matches[2]);
            if ($archivePath) {
                return 'src=' . $matches[1] . $archivePath . $matches[1];
            }
            return $matches[0];
        }, $html);
    }

    /** @return list<array{path:string,sha256:string,original_url:string}> */
    public function manifestAssets(): array {
        $assets = [];
        foreach ($this->byHash as $item) {
            $assets[] = [
                'path' => $item['path'],
                'sha256' => $item['sha256'],
                'original_url' => $item['original_url'],
            ];
        }
        return $assets;
    }

    /** @return array<string, string> archivePath => fullPath */
    public function filesForArchive(): array {
        $files = [];
        foreach ($this->byHash as $item) {
            $files[$item['path']] = $item['full_path'];
        }
        return $files;
    }
}

function mynote_fetch_page_images(PDO $pdo, int $pageId): array {
    try {
        $stmt = $pdo->prepare('SELECT image_url, ocr_text FROM page_images WHERE page_id = ? ORDER BY id ASC');
        $stmt->execute([$pageId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        return [];
    }
}

function mynote_build_notebooks_tree(PDO $pdo, int $userId, MyNoteAssetRegistry $registry): array {
    $stmt = $pdo->prepare('SELECT id, name, created_at FROM notebooks WHERE user_id = ? ORDER BY sort_order ASC, id ASC');
    $stmt->execute([$userId]);
    $notebooks = [];

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $notebook) {
        $sections = [];
        $secStmt = $pdo->prepare('SELECT id, name, created_at FROM sections WHERE notebook_id = ? ORDER BY sort_order ASC, id ASC');
        $secStmt->execute([(int)$notebook['id']]);

        foreach ($secStmt->fetchAll(PDO::FETCH_ASSOC) as $section) {
            $pages = [];
            $pageStmt = $pdo->prepare(
                'SELECT id, title, content, is_favorite, created_at, updated_at FROM pages WHERE section_id = ? ORDER BY sort_order ASC, id ASC'
            );
            $pageStmt->execute([(int)$section['id']]);

            foreach ($pageStmt->fetchAll(PDO::FETCH_ASSOC) as $page) {
                $contentUrls = mynote_collect_asset_urls_from_content($page['content']);
                foreach ($contentUrls as $url) {
                    $registry->registerUrl($url);
                }

                $images = [];
                foreach (mynote_fetch_page_images($pdo, (int)$page['id']) as $img) {
                    $archivePath = $registry->registerUrl($img['image_url']);
                    if ($archivePath) {
                        $images[] = [
                            'asset' => $archivePath,
                            'ocr_text' => $img['ocr_text'] ?? '',
                        ];
                    }
                }

                $pages[] = [
                    'id' => mynote_generate_export_id(),
                    'title' => $page['title'],
                    'content' => $registry->rewriteContent($page['content']),
                    'is_favorite' => (int)$page['is_favorite'],
                    'created_at' => $page['created_at'],
                    'updated_at' => $page['updated_at'],
                    'images' => $images,
                ];
            }

            $sections[] = [
                'id' => mynote_generate_export_id(),
                'name' => $section['name'],
                'created_at' => $section['created_at'],
                'pages' => $pages,
            ];
        }

        $notebooks[] = [
            'id' => mynote_generate_export_id(),
            'name' => $notebook['name'],
            'created_at' => $notebook['created_at'],
            'sections' => $sections,
        ];
    }

    return $notebooks;
}

function mynote_build_user_export(PDO $pdo, int $userId): array {
    $stmt = $pdo->prepare('SELECT email FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        throw new RuntimeException('User not found');
    }

    $registry = new MyNoteAssetRegistry();
    $notebooks = mynote_build_notebooks_tree($pdo, $userId, $registry);

    return [
        'format' => MYNOTE_FORMAT,
        'version' => MYNOTE_VERSION,
        'exported_at' => gmdate('c'),
        'scope' => 'user',
        'app' => 'MyNotes',
        'owner' => ['email' => $user['email']],
        'notebooks' => $notebooks,
        'assets' => $registry->manifestAssets(),
        '_registry' => $registry,
    ];
}

function mynote_build_system_export(PDO $pdo): array {
    $registry = new MyNoteAssetRegistry();
    $users = [];

    $stmt = $pdo->query('SELECT id, email, role FROM users ORDER BY id ASC');
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $user) {
        $users[] = [
            'email' => $user['email'],
            'role' => $user['role'],
            'notebooks' => mynote_build_notebooks_tree($pdo, (int)$user['id'], $registry),
        ];
    }

    return [
        'format' => MYNOTE_FORMAT,
        'version' => MYNOTE_VERSION,
        'exported_at' => gmdate('c'),
        'scope' => 'system',
        'app' => 'MyNotes',
        'users' => $users,
        'assets' => $registry->manifestAssets(),
        '_registry' => $registry,
    ];
}

function mynote_create_zip_from_manifest(array $manifest): string {
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('ZipArchive extension is not available');
    }

    /** @var MyNoteAssetRegistry $registry */
    $registry = $manifest['_registry'];
    unset($manifest['_registry']);

    $tempDir = sys_get_temp_dir() . '/mynote_export_' . bin2hex(random_bytes(8));
    if (!mkdir($tempDir, 0700, true) && !is_dir($tempDir)) {
        throw new RuntimeException('Could not create temporary export directory');
    }

    $assetsDir = $tempDir . '/assets';
    mkdir($assetsDir, 0700, true);

    foreach ($registry->filesForArchive() as $archivePath => $sourcePath) {
        $dest = $tempDir . '/' . str_replace('/', DIRECTORY_SEPARATOR, $archivePath);
        $destDir = dirname($dest);
        if (!is_dir($destDir)) {
            mkdir($destDir, 0700, true);
        }
        if (!copy($sourcePath, $dest)) {
            mynote_remove_dir($tempDir);
            throw new RuntimeException('Failed to copy asset into archive');
        }
    }

    $jsonPath = $tempDir . '/mynote.json';
    file_put_contents($jsonPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    $zipPath = sys_get_temp_dir() . '/mynote_' . bin2hex(random_bytes(8)) . '.mynote.zip';
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        mynote_remove_dir($tempDir);
        throw new RuntimeException('Could not create zip archive');
    }

    $zip->addFile($jsonPath, 'mynote.json');
    foreach ($registry->filesForArchive() as $archivePath => $sourcePath) {
        $zip->addFile($tempDir . '/' . str_replace('/', DIRECTORY_SEPARATOR, $archivePath), $archivePath);
    }
    $zip->close();
    mynote_remove_dir($tempDir);

    return $zipPath;
}

function mynote_remove_dir(string $dir): void {
    if (!is_dir($dir)) {
        return;
    }
    $items = scandir($dir);
    if ($items === false) {
        return;
    }
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) {
            mynote_remove_dir($path);
        } else {
            @unlink($path);
        }
    }
    @rmdir($dir);
}

function mynote_open_zip_safely(string $path): ZipArchive {
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('ZipArchive extension is not available');
    }

    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        throw new RuntimeException('Invalid or unreadable zip archive');
    }

    if ($zip->numFiles > MYNOTE_MAX_ZIP_ENTRIES) {
        $zip->close();
        throw new RuntimeException('Archive contains too many files');
    }

    $totalSize = 0;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $stat = $zip->statIndex($i);
        if (!$stat) {
            continue;
        }
        $name = str_replace('\\', '/', $stat['name']);
        if ($name === '' || strpos($name, '../') !== false || str_starts_with($name, '/')) {
            $zip->close();
            throw new RuntimeException('Archive contains unsafe paths');
        }
        $totalSize += (int)$stat['size'];
        if ($totalSize > MYNOTE_MAX_UNCOMPRESSED_BYTES) {
            $zip->close();
            throw new RuntimeException('Archive is too large');
        }
    }

    return $zip;
}

function mynote_extract_zip(string $zipPath): string {
    $zip = mynote_open_zip_safely($zipPath);
    $extractDir = sys_get_temp_dir() . '/mynote_import_' . bin2hex(random_bytes(8));
    mkdir($extractDir, 0700, true);

    for ($i = 0; $i < $zip->numFiles; $i++) {
        $stat = $zip->statIndex($i);
        if (!$stat) {
            continue;
        }
        $name = str_replace('\\', '/', $stat['name']);
        if (str_ends_with($name, '/')) {
            continue;
        }
        $dest = $extractDir . '/' . $name;
        $destDir = dirname($dest);
        if (!is_dir($destDir)) {
            mkdir($destDir, 0700, true);
        }
        copy('zip://' . $zipPath . '#' . $stat['name'], $dest);
    }

    $zip->close();

    if (!is_file($extractDir . '/mynote.json')) {
        mynote_remove_dir($extractDir);
        throw new RuntimeException('Archive is missing mynote.json');
    }

    return $extractDir;
}

function mynote_validate_manifest(array $manifest): void {
    if (($manifest['format'] ?? '') !== MYNOTE_FORMAT) {
        throw new RuntimeException('Unsupported archive format');
    }
    $version = (int)($manifest['version'] ?? 0);
    if ($version < 1 || $version > MYNOTE_VERSION) {
        throw new RuntimeException('Unsupported archive version');
    }

    $scope = $manifest['scope'] ?? '';
    if ($scope === 'user') {
        if (!isset($manifest['notebooks']) || !is_array($manifest['notebooks'])) {
            throw new RuntimeException('Invalid user archive: missing notebooks');
        }
    } elseif ($scope === 'system') {
        if (!isset($manifest['users']) || !is_array($manifest['users'])) {
            throw new RuntimeException('Invalid system archive: missing users');
        }
    } else {
        throw new RuntimeException('Invalid archive scope');
    }
}

function mynote_unique_child_name(PDO $pdo, string $table, string $parentColumn, int $parentId, string $name): string {
    $candidate = $name;
    $suffix = 1;
    while (true) {
        $stmt = $pdo->prepare("SELECT id FROM {$table} WHERE {$parentColumn} = ? AND name = ? LIMIT 1");
        $stmt->execute([$parentId, $candidate]);
        if (!$stmt->fetch()) {
            return $candidate;
        }
        if ($suffix === 1) {
            $candidate = $name . ' (imported)';
        } else {
            $candidate = $name . ' (' . $suffix . ')';
        }
        $suffix++;
    }
}

function mynote_restore_asset(string $extractDir, string $archivePath, array &$hashToUploadUrl): ?string {
    $archivePath = str_replace('\\', '/', $archivePath);
    $source = $extractDir . '/' . $archivePath;
    if (!is_file($source)) {
        return null;
    }

    $hash = hash_file('sha256', $source);
    if (isset($hashToUploadUrl[$hash])) {
        return $hashToUploadUrl[$hash];
    }

    $projectRoot = mynote_project_root();
    $uploadsDir = $projectRoot . '/uploads';
    if (!is_dir($uploadsDir)) {
        mkdir($uploadsDir, 0775, true);
    }

    $ext = strtolower(pathinfo($source, PATHINFO_EXTENSION) ?: 'bin');
    $newName = substr($hash, 0, 16) . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $dest = $uploadsDir . '/' . $newName;
    if (!copy($source, $dest)) {
        throw new RuntimeException('Failed to restore asset file');
    }

    $uploadUrl = 'uploads/' . $newName;
    $hashToUploadUrl[$hash] = $uploadUrl;
    return $uploadUrl;
}

function mynote_rewrite_import_content(string $content, callable $assetResolver): string {
    return preg_replace_callback('/src=(["\'])(assets\/[^"\']+)\1/i', function ($matches) use ($assetResolver) {
        $uploadUrl = $assetResolver($matches[2]);
        if ($uploadUrl) {
            return 'src=' . $matches[1] . $uploadUrl . $matches[1];
        }
        return $matches[0];
    }, $content);
}

function mynote_resolve_or_create_user(PDO $pdo, string $email, string $role): array {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($existing) {
        return ['id' => (int)$existing['id'], 'created' => false];
    }

    $role = $role === 'admin' ? 'admin' : 'member';
    $hash = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);
    $insert = $pdo->prepare("INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, ?, 'active')");
    $insert->execute([$email, $hash, $role]);
    return ['id' => (int)$pdo->lastInsertId(), 'created' => true];
}

function mynote_import_notebooks_for_user(
    PDO $pdo,
    int $userId,
    array $notebooks,
    string $extractDir,
    array &$hashToUploadUrl,
    array &$summary
): void {
    $assetResolver = function (string $archivePath) use ($extractDir, &$hashToUploadUrl, &$summary) {
        $url = mynote_restore_asset($extractDir, $archivePath, $hashToUploadUrl);
        if ($url) {
            $summary['assets_restored']++;
        }
        return $url;
    };

    foreach ($notebooks as $notebook) {
        $notebookName = mynote_unique_child_name($pdo, 'notebooks', 'user_id', $userId, $notebook['name'] ?? 'Imported folder');
        $nbInsert = $pdo->prepare('INSERT INTO notebooks (user_id, name, created_at) VALUES (?, ?, ?)');
        $nbInsert->execute([$userId, $notebookName, $notebook['created_at'] ?? gmdate('Y-m-d H:i:s')]);
        $notebookId = (int)$pdo->lastInsertId();
        $summary['notebooks_imported']++;

        foreach ($notebook['sections'] ?? [] as $section) {
            $sectionName = mynote_unique_child_name($pdo, 'sections', 'notebook_id', $notebookId, $section['name'] ?? 'Imported subfolder');
            $secInsert = $pdo->prepare('INSERT INTO sections (notebook_id, name, created_at) VALUES (?, ?, ?)');
            $secInsert->execute([$notebookId, $sectionName, $section['created_at'] ?? gmdate('Y-m-d H:i:s')]);
            $sectionId = (int)$pdo->lastInsertId();
            $summary['sections_imported']++;

            foreach ($section['pages'] ?? [] as $page) {
                $content = mynote_rewrite_import_content($page['content'] ?? '', $assetResolver);
                $pageInsert = $pdo->prepare(
                    'INSERT INTO pages (section_id, title, content, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
                );
                $pageInsert->execute([
                    $sectionId,
                    $page['title'] ?? 'Untitled',
                    $content,
                    (int)($page['is_favorite'] ?? 0),
                    $page['created_at'] ?? gmdate('Y-m-d H:i:s'),
                    $page['updated_at'] ?? gmdate('Y-m-d H:i:s'),
                ]);
                $pageId = (int)$pdo->lastInsertId();
                $summary['pages_imported']++;

                foreach ($page['images'] ?? [] as $image) {
                    $asset = $image['asset'] ?? '';
                    $uploadUrl = $asset ? $assetResolver($asset) : null;
                    if (!$uploadUrl) {
                        continue;
                    }
                    try {
                        $imgInsert = $pdo->prepare('INSERT INTO page_images (page_id, image_url, ocr_text) VALUES (?, ?, ?)');
                        $imgInsert->execute([$pageId, $uploadUrl, $image['ocr_text'] ?? '']);
                    } catch (PDOException $e) {
                        $summary['skipped']++;
                    }
                }
            }
        }
    }
}

function mynote_import_archive(PDO $pdo, string $extractDir, array $manifest, string $mode, int $targetUserId, bool $isSystemImport): array {
    mynote_validate_manifest($manifest);

    $summary = [
        'users_created' => 0,
        'notebooks_imported' => 0,
        'sections_imported' => 0,
        'pages_imported' => 0,
        'assets_restored' => 0,
        'skipped' => 0,
    ];
    $hashToUploadUrl = [];

    $pdo->beginTransaction();
    try {
        if ($mode === 'replace') {
            if ($isSystemImport) {
                $pdo->exec('DELETE FROM notebooks');
            } else {
                $del = $pdo->prepare('DELETE FROM notebooks WHERE user_id = ?');
                $del->execute([$targetUserId]);
            }
        }

        if (($manifest['scope'] ?? '') === 'user') {
            mynote_import_notebooks_for_user(
                $pdo,
                $targetUserId,
                $manifest['notebooks'] ?? [],
                $extractDir,
                $hashToUploadUrl,
                $summary
            );
        } else {
            foreach ($manifest['users'] ?? [] as $userEntry) {
                $email = trim($userEntry['email'] ?? '');
                if ($email === '') {
                    $summary['skipped']++;
                    continue;
                }
                $resolved = mynote_resolve_or_create_user($pdo, $email, $userEntry['role'] ?? 'member');
                if ($resolved['created']) {
                    $summary['users_created']++;
                }
                mynote_import_notebooks_for_user(
                    $pdo,
                    $resolved['id'],
                    $userEntry['notebooks'] ?? [],
                    $extractDir,
                    $hashToUploadUrl,
                    $summary
                );
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    return $summary;
}

function mynote_import_from_upload(PDO $pdo, string $zipPath, string $mode, string $scope, int $targetUserId): array {
    $extractDir = mynote_extract_zip($zipPath);
    try {
        $manifest = json_decode(file_get_contents($extractDir . '/mynote.json'), true);
        if (!is_array($manifest)) {
            throw new RuntimeException('Invalid mynote.json');
        }

        $archiveScope = $manifest['scope'] ?? 'user';
        if ($scope === 'system') {
            if ($archiveScope !== 'system') {
                throw new RuntimeException('Expected a system archive for admin import');
            }
        } elseif ($archiveScope !== 'user') {
            throw new RuntimeException('Expected a user archive for this import');
        }

        if (!in_array($mode, ['merge', 'replace'], true)) {
            throw new RuntimeException('Invalid import mode');
        }

        return mynote_import_archive($pdo, $extractDir, $manifest, $mode, $targetUserId, $scope === 'system');
    } finally {
        mynote_remove_dir($extractDir);
    }
}
