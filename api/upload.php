<?php
define('UPLOAD_DIR', realpath(__DIR__ . '/../uploads/') . DIRECTORY_SEPARATOR);
define('MAX_FILE_SIZE', 5242880); // 5MB
define('ALLOWED_MIME_TYPES', ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach ($_FILES as $file) {
        if ($file['size'] > MAX_FILE_SIZE) {
            http_response_code(400);
            echo json_encode(['message' => 'File size exceeds limit']);
            exit;
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);
        if (!in_array($mimeType, ALLOWED_MIME_TYPES)) {
            http_response_code(400);
            echo json_encode(['message' => 'Invalid file type']);
            exit;
        }

        $storedName = bin2hex(random_bytes(16)) . '.' . pathinfo($file['name'], PATHINFO_EXTENSION);
        $destination = UPLOAD_DIR . $storedName;

        if (move_uploaded_file($file['tmp_name'], $destination)) {
            echo json_encode(['message' => 'File uploaded successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['message' => 'Failed to upload file']);
        }
    }
} else {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
}
?>