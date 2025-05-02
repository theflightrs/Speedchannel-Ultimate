<?php
define('SECURE_ENTRY', true);
header('Content-Type: application/json');
require_once('../config.php');
require_once('../Security.php');
require_once('../db_setup.php');

$security = Security::getInstance();
$db = Database::getInstance();

try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'POST':
            if (!isset($_FILES['file'], $_POST['message_id'])) {
                throw new Exception('Missing required fields');
            }

            $file = $_FILES['file'];
            $messageId = $_POST['message_id'];

            // Validate message exists and user has access
            $message = $db->fetchOne(
                "SELECT m.*, c.is_private FROM messages m 
                 JOIN channels c ON m.channel_id = c.id 
                 WHERE m.id = ?",
                [$messageId]
            );

            if (!$message || !checkChannelAccess($message['channel_id'])) {
                throw new Exception('Access denied');
            }

            if ($file['error'] !== UPLOAD_ERR_OK) {
                throw new Exception('Upload failed');
            }

            if ($file['size'] > MAX_FILE_SIZE) {
                throw new Exception('File too large');
            }

            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mimeType = $finfo->file($file['tmp_name']);
            if (!in_array($mimeType, ALLOWED_MIME_TYPES)) {
                throw new Exception('File type not allowed');
            }

            $storedName = bin2hex(random_bytes(16)) . '.' . pathinfo($file['name'], PATHINFO_EXTENSION);
            if (!move_uploaded_file($file['tmp_name'], UPLOAD_DIR . $storedName)) {
                throw new Exception('Failed to save file');
            }

            $fileId = $db->insert(
                "INSERT INTO files (message_id, original_name, stored_name, mime_type, file_size) 
                 VALUES (?, ?, ?, ?, ?)",
                [
                    $messageId,
                    $file['name'],
                    $storedName,
                    $mimeType,
                    $file['size']
                ]
            );

            $db->update(
                "UPDATE messages SET has_attachment = 1 WHERE id = ?",
                [$messageId]
            );

            echo json_encode([
                'success' => true,
                'file_id' => $fileId
            ]);
            break;

            case 'GET':
                if (!isset($_GET['path'])) {
                    throw new Exception('File path required');
                }
            
                $storedName = basename($_GET['path']);
                $path = UPLOAD_DIR . $storedName;
            
                error_log("Serving file: $path");
                error_log("File exists: " . (file_exists($path) ? 'yes' : 'no'));
                error_log("File size: " . (file_exists($path) ? filesize($path) : 'n/a'));
                error_log("Mime type: " . (file_exists($path) ? mime_content_type($path) : 'n/a'));
            
                if (!file_exists($path)) {
                    throw new Exception("File not found: $path");
                }
            
                $mimeType = mime_content_type($path);
                if (!$mimeType) {
                    $mimeType = 'application/octet-stream';
                }
            
                header('Content-Type: ' . $mimeType);
                header('Content-Length: ' . filesize($path));
                header('X-Content-Type-Options: nosniff');
                
                ob_clean(); // Clear output buffer
                flush(); // Flush system output buffer
                readfile($path);
                exit;

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

function checkChannelAccess($channelId) {
    global $db;
    if (!isset($_SESSION['user_id'])) return false;

    $channel = $db->fetchOne(
        "SELECT * FROM channels WHERE id = ?",
        [$channelId]
    );

    if (!$channel) return false;
    if ($_SESSION['is_admin']) return true;
    if ($channel['creator_id'] == $_SESSION['user_id']) return true;
    if (!$channel['is_private']) return true;

    return (bool)$db->fetchOne(
        "SELECT 1 FROM channel_users 
         WHERE channel_id = ? AND user_id = ?",
        [$channelId, $_SESSION['user_id']]
    );
}