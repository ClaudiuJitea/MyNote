<?php
require_once 'config.php';
requireLogin();

header('Content-Type: application/json');

const UPLOAD_MAX_BYTES = 5242880;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    $code = $_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) {
        http_response_code(400);
        echo json_encode(['error' => 'File exceeds maximum upload size (5 MB).']);
        exit;
    }
    echo json_encode(['error' => 'No file uploaded or upload error.']);
    exit;
}

$fileTmpPath = $_FILES['image']['tmp_name'];
$fileSize = (int)$_FILES['image']['size'];

if ($fileSize <= 0 || $fileSize > UPLOAD_MAX_BYTES) {
    http_response_code(400);
    echo json_encode(['error' => 'File exceeds maximum upload size (5 MB).']);
    exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = $finfo ? finfo_file($finfo, $fileTmpPath) : null;
if ($finfo) {
    finfo_close($finfo);
}

$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];

if (!$mime || !isset($allowedMimes[$mime])) {
    http_response_code(400);
    echo json_encode(['error' => 'Upload failed. Allowed file types: jpg, jpeg, png, webp']);
    exit;
}

$imageInfo = @getimagesize($fileTmpPath);
if ($imageInfo === false) {
    http_response_code(400);
    echo json_encode(['error' => 'Uploaded file is not a valid image.']);
    exit;
}

$extension = $allowedMimes[$mime];
$newFileName = bin2hex(random_bytes(16)) . '.' . $extension;
$uploadFileDir = '../uploads/';
$dest_path = $uploadFileDir . $newFileName;

if (!is_dir($uploadFileDir)) {
    mkdir($uploadFileDir, 0775, true);
}

if (!move_uploaded_file($fileTmpPath, $dest_path)) {
    echo json_encode(['error' => 'There was an error moving the file to upload directory.']);
    exit;
}

$imageUrl = 'uploads/' . $newFileName;
$page_id = $_POST['page_id'] ?? null;
$ocr_text = $_POST['ocr_text'] ?? '';

if ($page_id) {
    $stmt = $pdo->prepare("
        SELECT p.id FROM pages p
        JOIN sections s ON p.section_id = s.id
        JOIN notebooks n ON s.notebook_id = n.id
        WHERE p.id = ? AND n.user_id = ?
    ");
    $stmt->execute([$page_id, $_SESSION['user_id']]);
    if ($stmt->fetch()) {
        $insert = $pdo->prepare('INSERT INTO page_images (page_id, image_url, ocr_text) VALUES (?, ?, ?)');
        $insert->execute([$page_id, $imageUrl, $ocr_text]);
    }
}

echo json_encode(['success' => true, 'url' => $imageUrl]);
