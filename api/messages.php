<?php
define('SECURE_ENTRY', true); 
header('Content-Type: application/json');
require_once('../config.php');
require_once('../Security.php');
require_once('../db_setup.php');

$security = Security::getInstance();
$db = Database::getInstance();

/**
 * Check if the current user has access to the given channel.
 */
function checkChannelAccess($channelId) {
    if (!isset($_SESSION['user_id'])) {
        return false;
    }

    global $db;

    $channel = $db->fetchOne(
        "SELECT * FROM channels WHERE id = ?",
        [$channelId]
    );

    if (!$channel) {
        return false;
    }

    // Admin has access to all channels
    if ($_SESSION['is_admin']) {
        return true;
    }

    // Creator has access to their channels
    if ($channel['creator_id'] == $_SESSION['user_id']) {
        return true;
    }

    // Public channel access
    if (!$channel['is_private']) {
        return true;
    }

    // Check membership for private channels
    $isMember = $db->fetchOne(
        "SELECT 1 FROM channel_users 
         WHERE channel_id = ? AND user_id = ?",
        [$channelId, $_SESSION['user_id']]
    );

    return (bool)$isMember;
}

/**
 * Handle GET requests to retrieve messages for a specific channel.
 */
function getMessages() {
    global $db, $security;

    $channelId = $_GET['channel_id'] ?? null;
    $includeFiles = $_GET['include_files'] ?? false;
    $type = $_GET['type'] ?? null;  // Add type parameter for filtering knocks

    if (!$channelId) {
        throw new Exception('Channel ID is required.');
    }

    // Allow access to system messages (knocks) for channel creators/admins
    $channel = $db->fetchOne("SELECT creator_id FROM channels WHERE id = ?", [$channelId]);
    $isCreatorOrAdmin = ($channel && ($channel['creator_id'] == $_SESSION['user_id'] || $_SESSION['is_admin']));

    if (!$isCreatorOrAdmin && !checkChannelAccess($channelId)) {
        throw new Exception('Access denied.');
    }

    // Base query
    $baseQuery = $includeFiles 
        ? "SELECT m.*, u.username, f.id as file_id, f.original_name as file_name, f.mime_type" 
        : "SELECT m.*, u.username";

    // Handle knock messages specifically
    if ($type === 'knock') {
        $query = "$baseQuery 
                 FROM messages m 
                 JOIN users u ON m.sender_id = u.id
                 LEFT JOIN files f ON m.id = f.message_id 
                 WHERE m.channel_id = ? AND m.is_system = 1
                 ORDER BY m.created_at DESC";
    } else {
        $query = "$baseQuery 
                 FROM messages m 
                 JOIN users u ON m.sender_id = u.id
                 LEFT JOIN files f ON m.id = f.message_id 
                 WHERE m.channel_id = ?
                 ORDER BY m.created_at ASC";
    }

    $messages = $db->fetchAll($query, [$channelId]);

    foreach ($messages as &$message) {
        $message['content'] = $security->decrypt(
            $message['encrypted_content'], 
            $message['iv'], 
            $message['tag'], 
            ENCRYPTION_KEY
        ) ?: '[Decryption failed]';

        $message['is_owner'] = $message['sender_id'] == $_SESSION['user_id'];
        $message['is_admin'] = $_SESSION['is_admin'] ?? false;
    }

    echo json_encode([
        'success' => true,
        'messages' => $messages
    ]);
}

/**
 * Handle POST requests to send a message to a specific channel.
 */
function sendMessage() {
    global $db, $security;

    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['channel_id'], $data['content'])) {
        throw new Exception('Missing required fields');
    }

    $channelId = $data['channel_id'];
    $content = trim($data['content']);

    if (empty($content)) {
        throw new Exception('Message content cannot be empty');
    }

    if (!checkChannelAccess($channelId)) {
        throw new Exception('Access denied to this channel');
    }

    $encrypted = $security->encrypt($content, ENCRYPTION_KEY);
    
    $messageId = $db->insert(
        "INSERT INTO messages (channel_id, sender_id, encrypted_content, iv, tag, created_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())",
        [
            $channelId,
            $_SESSION['user_id'],
            $encrypted['ciphertext'],
            $encrypted['iv'],
            $encrypted['tag']
        ]
    );

    if (!$messageId) {
        throw new Exception('Failed to insert message');
    }

    echo json_encode([
        'success' => true,
        'message_id' => $messageId
    ]);
}

/**
 * Handle DELETE requests to remove messages.
 */
function deleteMessage() {
    global $db;

    $messageId = $_GET['id'] ?? null;

    if (!$messageId) {
        http_response_code(400); // Bad Request
        echo json_encode(['success' => false, 'error' => 'Message ID is required']);
        return;
    }


    $messageId = $_GET['id'] ?? null;

if (!$messageId) {
    error_log("Message ID is missing in DELETE request");
    throw new Exception('Message ID is required', 400);
}

error_log("Attempting to delete message with ID: $messageId");
    // Debugging: Log the message ID
    error_log("Attempting to delete message with ID: $messageId");

    // Verify user permissions
    $message = $db->fetchOne(
        "SELECT sender_id FROM messages WHERE id = ?",
        [$messageId]
    );
    
    if (!$message) {
        error_log("Message with ID $messageId does not exist in the database");
        throw new Exception('Message not found', 404);
    }

    if ($message['sender_id'] !== $_SESSION['user_id'] && !$_SESSION['is_admin']) {
        error_log("User lacks permission to delete message ID $messageId");
        throw new Exception('Permission denied', 403);
    }

    $db->delete("DELETE FROM messages WHERE id = ?", [$messageId]);
    echo json_encode(['success' => true, 'message' => 'Message deleted']);
}

// Main logic begins here
try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            getMessages();
            break;

        case 'POST':
            sendMessage();
            break;

            case 'DELETE':
                $action = $_GET['action'] ?? null;
            
                if ($action === 'deleteOld') {
                    // Automatic deletion of old messages
                    $age = 30; // Example: Messages older than 30 days
                    $db->delete(
                        "DELETE FROM messages WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)", 
                        [$age]
                    );
                    echo json_encode(['success' => true, 'message' => 'Old messages deleted']);
                    exit;
                }
            
                // Manual deletion by ID
                $messageId = $_GET['id'] ?? null;
                if (!$messageId) {
                    throw new Exception('Message ID is required', 400);
                }
            
                // Verify user permissions
                $message = $db->fetchOne(
                    "SELECT sender_id FROM messages WHERE id = ?",
                    [$messageId]
                );
            
                if (!$message) {
                    throw new Exception('Message not found', 404);
                }
            
                if ($message['sender_id'] !== $_SESSION['user_id'] && !$_SESSION['is_admin']) {
                    throw new Exception('Permission denied', 403);
                }
            
                $db->delete("DELETE FROM messages WHERE id = ?", [$messageId]);
                echo json_encode(['success' => true, 'message' => 'Message deleted']);
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