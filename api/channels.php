<?php

define('SECURE_ENTRY', true);
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.use_only_cookies', 1);

header('Content-Type: application/json');
require_once(__DIR__ . '/../config.php');
require_once(__DIR__ . '/../Security.php'); // Assuming Security.php exists and handles security checks
require_once(__DIR__ . '/../db_setup.php'); // Assuming db_setup.php provides the Database class/instance

$security = Security::getInstance();
$db = Database::getInstance();

try {
    // Authentication check - ensure user is logged in
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401); // Unauthorized
        throw new Exception('Not authenticated');
    }
    $userId = $_SESSION['user_id']; // Get user ID after check

    // Determine the action from JSON payload (for POST) or GET parameters
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $data['action'] ?? ($_GET['action'] ?? 'list'); // Default action to 'list' if not specified

    // Log the received request for debugging
    error_log("[channels.php] Action: $action, UserID: $userId");
    // error_log("[channels.php] Received data: " . print_r($data, true)); // Uncomment for verbose data logging

    // Execute the requested action
    switch ($action) {
        case 'create':
            // Ensure it's a POST request for creating resources
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                 http_response_code(405); // Method Not Allowed
                 throw new Exception('Invalid request method for create action.');
            }
            $result = handleCreateChannel($db, $data, $userId);
            break;
        case 'list':
            // Ensure it's a GET request for listing resources
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                 http_response_code(405); // Method Not Allowed
                 throw new Exception('Invalid request method for list action.');
            }
            $result = handleListChannels($db, $userId);
            break;
            case 'count':
                $userId = $_GET['user_id'];
                $count = $db->fetchOne("SELECT COUNT(*) as count FROM channels WHERE creator_id = ?", [$userId]);
                echo json_encode(['success' => true, 'count' => $count['count']]);
                break;
			case 'update':
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        throw new Exception('Invalid request method for update action.');
    }
    
    $channelId = $data['channel_id'] ?? null;
    $name = $data['name'] ?? null;
    $isPrivate = $data['is_private'] ?? null;
    $isDiscoverable = $data['is_discoverable'] ?? true;
    
    if (!$channelId || !$name) {
        throw new Exception('Channel ID and name are required.');
    }
    
    // Check permissions
    $channel = $db->fetchOne(
        "SELECT creator_id FROM channels WHERE id = ?",
        [$channelId]
    );
    
    if (!$channel || ($channel['creator_id'] != $_SESSION['user_id'] && !$_SESSION['is_admin'])) {
        http_response_code(403); // Forbidden
        throw new Exception('Permission denied');
    }
    
   
    // Update channel
    $db->update(
        "UPDATE channels SET name = ?, is_private = ?, is_discoverable = ? WHERE id = ?",
        [$name, $isPrivate ? 1 : 0, $isDiscoverable ? 1 : 0, $channelId]
    );
    
    $result = ['success' => true];
    break;
			
        // Add cases for 'update', 'delete', 'join', 'leave', 'settings' etc. as needed
		case 'delete':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                http_response_code(405);
                throw new Exception('Invalid request method for delete action.');
            }
            
            $channelId = $data['channel_id'] ?? null;
            if (!$channelId) {
                throw new Exception('Channel ID is required.');
            }
            
            // Check permissions
            $channel = $db->fetchOne(
                "SELECT creator_id FROM channels WHERE id = ?",
                [$channelId]
            );
            
            if (!$channel || ($channel['creator_id'] != $userId && !$_SESSION['is_admin'])) {
                http_response_code(403);
                throw new Exception('Permission denied');
            }
            
            try {
                $db->beginTransaction();
                
                // First get all files that need to be deleted
                $files = $db->fetchAll(
                    "SELECT f.stored_name 
                     FROM files f 
                     JOIN messages m ON f.message_id = m.id 
                     WHERE m.channel_id = ?",
                    [$channelId]
                );
                
                // Delete physical files
                foreach ($files as $file) {
                    $filepath = __DIR__ . '/../uploads/' . $file['stored_name'];
                    if (file_exists($filepath)) {
                        unlink($filepath);
                    }
                }
                
                // Delete messages (will cascade delete files from database)
                $db->delete("DELETE FROM messages WHERE channel_id = ?", [$channelId]);
                
                // Delete channel users
                $db->delete("DELETE FROM channel_users WHERE channel_id = ?", [$channelId]);
                
                // Delete the channel
                $db->delete("DELETE FROM channels WHERE id = ?", [$channelId]);
                
                $db->commit();
                $result = ['success' => true];
            } catch (Exception $e) {
                $db->rollBack();
                throw new Exception('Failed to delete channel: ' . $e->getMessage());
            }
            break;
    case 'remove-user':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405); // Method Not Allowed
            throw new Exception('Invalid request method for remove-user action.');
        }
    
        $channelId = $data['channel_id'] ?? null;
        $userId = $data['user_id'] ?? null;
    
        if (!$channelId || !$userId) {
            throw new Exception('Channel ID and User ID are required.');
        }
    
        // Check permissions
        $channel = $db->fetchOne(
            "SELECT creator_id FROM channels WHERE id = ?",
            [$channelId]
        );
    
        if (!$channel || ($channel['creator_id'] != $_SESSION['user_id'] && !$_SESSION['is_admin'])) {
            http_response_code(403); // Forbidden
            throw new Exception('Permission denied.');
        }
    
        // Prevent removing the channel creator
        if ($userId == $channel['creator_id']) {
            throw new Exception('Cannot remove the channel creator.');
        }
    
        // Remove user from channel
        $result = $db->delete(
            "DELETE FROM channel_users WHERE channel_id = ? AND user_id = ?",
            [$channelId, $userId]
        );
    
        if (!$result) {
            throw new Exception('Failed to remove user from the channel.');
        }
    
        echo json_encode(['success' => true]);
        break;
		
        default:
            http_response_code(400); // Bad Request
            throw new Exception('Invalid action specified.');
    }

    // Send success response (status code 200 is default)
    echo json_encode($result);

} catch (Exception $e) {
    // Log the error
    error_log("[channels.php] Error: " . $e->getMessage() . " on line " . $e->getLine() . " in " . $e->getFile());

    // Set appropriate HTTP status code based on error type if possible
    $statusCode = http_response_code(); // Get current code (might have been set before)
    if ($statusCode < 400) { // If no specific error code was set, default to 400
        http_response_code(400); // Bad Request is a common default for client errors
    }
    if (http_response_code() === 401) { // Keep 401 if it was set for auth failure
         // Keep 401
    } elseif (http_response_code() === 405) {
         // Keep 405
    } else {
         // Use 400 for most other validation/request errors
         http_response_code(400);
    }


    // Send error response
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * Lists all channels the user is a member of.
 *
 * @param Database $db Database instance.
 * @param int $userId ID of the logged-in user.
 * @return array Associative array with success status and channels list.
 * @throws Exception If database query fails.
 */
function handleListChannels($db, $userId) {
    $isAdmin = $db->fetchOne("SELECT is_admin FROM users WHERE id = ?", [$userId])['is_admin'] ?? 0;

    $query = "SELECT c.*, 
        CASE WHEN c.creator_id = ? THEN 1 ELSE 0 END as is_creator,
        CASE WHEN cu.user_id IS NOT NULL THEN 1 ELSE 0 END as is_member,
        CASE WHEN c.creator_id = ? OR cu.user_id IS NOT NULL OR c.is_private = 0 THEN 1 ELSE 0 END as has_access
    FROM channels c
    LEFT JOIN channel_users cu ON c.id = cu.channel_id AND cu.user_id = ?
    WHERE 
        ? = 1  -- Admin sees all channels
        OR c.is_private = 0  -- Open channels
        OR (c.is_private = 1 AND c.is_discoverable = 1)  -- Private discoverable channels
        OR c.creator_id = ?  -- Creator sees their channels
        OR cu.user_id IS NOT NULL  -- Member sees their channels
    ORDER BY c.name ASC";

    $channels = $db->fetchAll($query, [$userId, $userId, $userId, $isAdmin, $userId]);
    
    // ETag support
    $etag = md5(json_encode($channels));
    header('ETag: ' . $etag);

    // Check if client has valid cached version
    if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && $_SERVER['HTTP_IF_NONE_MATCH'] === $etag) {
        http_response_code(304);
        exit;
    }

    return [
        'success' => true,
        'channels' => $channels
    ];
}
/**
 * Creates a new channel and assigns the creator as an admin member.
 *
 * @param Database $db Database instance.
 * @param array $data Input data from the request payload.
 * @param int $userId ID of the user creating the channel.
 * @return array Associative array with success status and new channel ID.
 * @throws Exception If validation fails or database operation fails.
 */
function handleCreateChannel($db, $data, $userId) {

    $count = $db->fetchOne("SELECT COUNT(*) as count FROM channels WHERE creator_id = ?", [$userId]);
    
    if ($count['count'] >= MAX_CHANNELS_PER_USER) {
        throw new Exception("You can only create up to " . MAX_CHANNELS_PER_USER . " channels");
        
    }
    // --- Input Validation ---
	 $name = trim($data['name'] ?? '');
    $is_private = $data['is_private'] ?? true;
    $is_discoverable = $data['is_discoverable'] ?? false;  // Default to discoverable
	
    $name = trim($data['name'] ?? '');
    if (empty($name)) {
        throw new Exception('Channel name is required.');
    }
    if (mb_strlen($name) > 50) { // Use mb_strlen for multi-byte character safety
        throw new Exception('Channel name must be 50 characters or less.');
    }

    // *** CORRECT HANDLING OF is_private ***
    // Get the boolean value from input, default to false or true as desired
    $is_private_input = $data['is_private'] ?? false; // Default to public if not specified
    // Convert the boolean to an integer (1 for true, 0 for false) for the database
    $is_private_db_value = $is_private_input ? 1 : 0;
    // *************************************

    // --- Database Operations ---
    $db->beginTransaction();
    try {
        error_log("[channels.php] handleCreateChannel: Creating channel '$name' (Private: $is_private_db_value) for UserID: $userId");

        // Insert the new channel record
        // Assuming $db->insert handles prepared statements internally or returns lastInsertId
        $channelId = $db->insert(
           "INSERT INTO channels (name, creator_id, is_private, is_discoverable, created_at)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP())",
        [$name, $userId, $is_private ? 1 : 0, $is_discoverable ? 1 : 0]
        );

        if (!$channelId) {
            throw new Exception('Failed to insert channel into database.');
        }
        error_log("[channels.php] handleCreateChannel: Inserted channel row, ID: $channelId");

        // Add the creator to the channel_users junction table as 'admin'
        $memberResult = $db->insert(
            "INSERT INTO channel_users (channel_id, user_id, role, joined_at)
             VALUES (?, ?, 'admin', UTC_TIMESTAMP())",
            [$channelId, $userId]
        );

        if (!$memberResult) {
            // This could return 0 if no rows affected, or false/exception on error.
            // Check your DB wrapper's behavior. Assuming failure if not positive result.
            throw new Exception('Failed to assign creator as channel member.');
        }
        error_log("[channels.php] handleCreateChannel: Added UserID $userId as admin to ChannelID $channelId");

        // Commit the transaction if all operations succeeded
        $db->commit();
        error_log("[channels.php] handleCreateChannel: Transaction committed successfully.");

        // Return success response
        return [
            'success' => true,
            'message' => 'Channel created successfully.', // Optional success message
            'channel_id' => $channelId
        ];
    } catch (Exception $e) {
        // Roll back the transaction on any error
        $db->rollBack();
        error_log("[channels.php] Error in handleCreateChannel (Transaction rolled back): " . $e->getMessage());
        // Re-throw the exception to be caught by the main error handler
        throw $e;
    }
}
?>