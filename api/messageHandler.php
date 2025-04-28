<?php
define('UPLOAD_DIR', realpath(__DIR__ . '/../uploads/') . DIRECTORY_SEPARATOR);
define('MAX_FILE_SIZE', 5242880); // 5MB
define('ALLOWED_MIME_TYPES', ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']);
define('ENCRYPTION_ALGORITHM', 'aes-256-gcm');

require_once('../config.php');
require_once('../db/DatabaseHelper.php');
require_once('../Security.php');

$security = Security::getInstance();
$db = Database::getInstance();

header('Content-Type: application/json');

// Authenticate the user
if (!$security->isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'POST':
            handlePostRequest();
            break;
        case 'GET':
            handleGetRequest();
            break;
        default:
            throw new Exception('Invalid request method');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

// Handles message posting and file uploads
function handlePostRequest() {
    global $db, $security;

    $message = $_POST['message'] ?? '';
    $channelId = $_POST['channel_id'] ?? null;

    if (!$channelId) {
        throw new Exception('Channel ID is required');
    }

    $uploadedFiles = processUploadedFiles();

    // Encrypt and save the message
    $encrypted = $security->encrypt($message, ENCRYPTION_KEY);
    $messageId = $db->insert(
        "INSERT INTO messages (channel_id, sender_id, encrypted_content, iv, tag, has_attachment, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())",
        [
            $channelId,
            $_SESSION['user_id'],
            $encrypted['ciphertext'],
            $encrypted['iv'],
            $encrypted['tag'],
            !empty($uploadedFiles)
        ]
    );

    // Save uploaded file metadata
    foreach ($uploadedFiles as $file) {
        $db->insert(
            "INSERT INTO files (message_id, original_name, stored_name, mime_type, file_size, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())",
            [
                $messageId,
                $file['original_name'],
                $file['stored_name'],
                $file['mime_type'],
                $file['file_size']
            ]
        );
    }

    echo json_encode(['success' => true, 'messageId' => $messageId, 'files' => $uploadedFiles]);
}

// Handles fetching messages
function handleGetRequest() {
    global $db, $security;

    $channelId = $_GET['channel_id'] ?? null;

    if (!$channelId) {
        throw new Exception('Channel ID is required');
    }

    $messages = $db->fetchAll(
        "SELECT * FROM messages WHERE channel_id = ? ORDER BY created_at ASC",
        [$channelId]
    );

    foreach ($messages as &$message) {
        $message['content'] = $security->decrypt(
            $message['encrypted_content'],
            $message['iv'],
            $message['tag'],
            ENCRYPTION_KEY
        ) ?: '[Decryption failed]';
    }

    echo json_encode(['success' => true, 'messages' => $messages]);
}

// Processes uploaded files
function processUploadedFiles() {
    $uploadedFiles = [];

    foreach ($_FILES as $file) {
        if ($file['size'] > MAX_FILE_SIZE) {
            throw new Exception('File size exceeds limit');
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);
        if (!in_array($mimeType, ALLOWED_MIME_TYPES)) {
            throw new Exception('Invalid file type');
        }

        $storedName = bin2hex(random_bytes(16)) . '.' . pathinfo($file['name'], PATHINFO_EXTENSION);
        $destination = UPLOAD_DIR . $storedName;

        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            throw new Exception('Failed to save file');
        }

       $uploadedFiles[] = [
            'original_name' => $file['name'],
            'stored_name' => $storedName,
            'mime_type' => $mimeType,
            'file_size' => $file['size']
        ];
    }

    return $uploadedFiles;
}
