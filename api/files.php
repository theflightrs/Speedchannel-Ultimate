<?php
define('SECURE_ENTRY', true);
require_once(__DIR__ . '/../config.php');
require_once(__DIR__ . '/../Security.php');
require_once(__DIR__ . '/../db_setup.php');

header('Content-Type: application/json');

$security = Security::getInstance();
$db = Database::getInstance();

if (!$security->isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            getFile();
            break;
        case 'POST':
            uploadFile();
            break;
        default:
            throw new Exception('Invalid request method');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function getFile() {
    global $db, $security;
    
    $fileId = $_GET['id'] ?? null;
    if (!$fileId) throw new Exception('File ID required');

    $file = $db->fetchOne(
        "SELECT f.*, m.channel_id 
         FROM files f 
         INNER JOIN messages m ON f.message_id = m.id 
         WHERE f.id = ?",
        [$fileId]
    );

    if (!$file || !hasChannelAccess($file['channel_id'])) {
        throw new Exception('Access denied');
    }

    $filePath = UPLOAD_DIR . $file['stored_name'];
    if (!file_exists($filePath)) {
        throw new Exception('File not found');
    }

    header('Content-Type: ' . $file['mime_type']);
    header('Content-Disposition: inline; filename="' . $file['original_name'] . '"');
    header('Content-Length: ' . $file['file_size']);
    readfile($filePath);
    exit;
}

function uploadFile() {
    global $db, $security;

    if (!isset($_FILES['file'])) {
        throw new Exception('No file uploaded');
    }

    $messageId = $_POST['message_id'] ?? null;
    if (!$messageId) {
        throw new Exception('Message ID required');
    }

    // Verify message exists and user has access
    $message = $db->fetchOne(
        "SELECT channel_id FROM messages WHERE id = ?",
        [$messageId]
    );

    if (!$message || !hasChannelAccess($message['channel_id'])) {
        throw new Exception('Access denied');
    }

    $fileInfo = $security->validateFileUpload($_FILES['file']);
    $uploadResult = $security->secureUpload($_FILES['file']);

    $fileId = $db->insert(
        "INSERT INTO files (message_id, original_name, stored_name, mime_type, file_size, created_at) 
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())",
        [
            $messageId,
            $uploadResult['original_name'],
            $uploadResult['stored_name'],
            $uploadResult['mime_type'],
            $uploadResult['file_size']
        ]
    );

    $db->update(
        "UPDATE messages SET has_attachment = TRUE WHERE id = ?",
        [$messageId]
    );

    echo json_encode([
        'success' => true,
        'file_id' => $fileId
    ]);
}

function hasChannelAccess($channelId) {
    global $db;
    
    $access = $db->fetchOne(
        "SELECT 1 FROM channel_users 
         WHERE channel_id = ? AND user_id = ?",
        [$channelId, $_SESSION['user_id']]
    );

    return (bool)$access;
}