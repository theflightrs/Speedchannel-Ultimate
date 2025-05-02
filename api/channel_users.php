<?php

define('SECURE_ENTRY', true);
require_once('../config.php');
require_once('../Security.php');
require_once('../db_setup.php');

// After requires, before class definition
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);


class ChannelUserHandler {
    private $db;
    private $security;
    
    public function __construct() {
        $this->db = Database::getInstance();
        $this->security = Security::getInstance();
    }
    
  // Fix the switch statement structure in handleRequest()
  public function handleRequest() {
    header('Content-Type: application/json');
    
    try {
        if (!$this->security->isAuthenticated()) {
            http_response_code(401);
            throw new Exception('Unauthorized access');
        }
        
        switch ($_SERVER['REQUEST_METHOD']) {
            case 'GET':
                $action = $_GET['action'] ?? 'list';
                
                switch ($action) {
                    case 'list':
                        $this->handleGetChannelUsers();
                        break;
                        case 'list_invites':
                            $invites = $this->db->fetchAll(
                                "SELECT m.id, m.channel_id, c.name as channel_name 
                                 FROM messages m 
                                 JOIN channels c ON m.channel_id = c.id 
                                 WHERE m.recipient_id = ? 
                                 AND m.type = 'invitation' 
                                 AND m.is_system = 1",
                                [$_SESSION['user_id']]
                            );
                            echo json_encode([
                                'success' => true,
                                'invitations' => $invites
                            ]);
                            break;
                    default:
                        throw new Exception('Invalid action');
                }
                break;

                case 'POST':
                    $data = json_decode(file_get_contents('php://input'), true);
                    $action = $data['action'] ?? '';
                    
                    switch ($action) {
                        case 'remove':  // <-- Move this case here
                            $this->handleRemoveUser();
                            break;
                        case 'invite':
                            $this->handleInvite();
                            break;
                        case 'retract_invite':
                            $this->handleRetractInvite();
                            break;
                        case 'invitation_response':
                            $this->handleInvitationResponse();
                            break;
                        case 'knock':  // Move this inside POST action's switch
                            $this->handleKnock();
                            break;
                        case 'knock_response':  // Move this inside POST action's switch
                            $this->handleKnockResponse();
                            break;
                        default:
                            $this->handleAssignUser();
                    }
                    break;
                    
            default:
                throw new Exception('Method not allowed', 405);
        }
    } catch (Exception $e) {
        http_response_code($e->getCode() ?: 500);
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
}



    private function canSendMessage($channelId, $userId) {
        
        $channel = $this->db->fetchOne(
            "SELECT * FROM channels WHERE id = ?",
            [$channelId]
        );
        
        if (!$channel) {
            return false;
        }
        
        // Allow if user is creator
        if ($channel['creator_id'] == $userId) {
            return true;
        }
        
        // Allow if channel is open
        if (!$channel['is_private']) {
            return true;
        }
        
        // Check if user is a member for private channels
        $isMember = $this->db->fetchOne(
            "SELECT 1 FROM channel_users 
             WHERE channel_id = ? AND user_id = ?",
            [$channelId, $userId]
        );
        
        return (bool)$isMember;
    }
	
	
	private function handleKnock() {
        $data = json_decode(file_get_contents('php://input'), true);
        $channelId = $data['channel_id'] ?? null;
        
        if (!$channelId) {
            throw new Exception('Channel ID required', 400);
        }
        
    // Check for existing pending knock
    $existingKnock = $this->db->fetchOne(
        "SELECT 1 FROM messages 
         WHERE channel_id = ? AND sender_id = ? AND is_system = 1",
        [$channelId, $_SESSION['user_id']]
    );
    
    if ($existingKnock) {
        throw new Exception('Already requested to join', 400);
    }
    
        
        // Verify channel exists and is private
        $channel = $this->db->fetchOne(
            "SELECT * FROM channels WHERE id = ? AND is_private = TRUE",
            [$channelId]
        );
        
        if (!$channel) {
            throw new Exception('Channel not found or not private', 404);
        }
        
        // Check if user is already a member
        $isMember = $this->db->fetchOne(
            "SELECT 1 FROM channel_users WHERE channel_id = ? AND user_id = ?",
            [$channelId, $_SESSION['user_id']]
        );
        
        if ($isMember) {
            throw new Exception('Already a member', 400);
        }
        
        // Create knock message with proper system message flag
        $knockMessage = "User {$_SESSION['username']} is requesting to join this channel";
        $encrypted = $this->security->encrypt($knockMessage, ENCRYPTION_KEY);
        
        $messageId = $this->db->insert(
            "INSERT INTO messages (channel_id, sender_id, encrypted_content, iv, tag, is_system)
             VALUES (?, ?, ?, ?, ?, 1)",
            [
                $channelId,
                $_SESSION['user_id'],
                $encrypted['ciphertext'],
                $encrypted['iv'],
                $encrypted['tag']
            ]
        );
    
        if (!$messageId) {
            throw new Exception('Failed to create knock message');
        }
        
        echo json_encode(['success' => true, 'message_id' => $messageId]);
    }

    private function handleKnockResponse() {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($data['knock_id'])) {
                throw new Exception('Knock ID required', 400);
            }
    
            // Get the knock message first
            $knock = $this->db->fetchOne(
                "SELECT m.id, m.sender_id, m.channel_id
                 FROM messages m
                 WHERE m.id = ? AND m.is_system = 1",
                [$data['knock_id']]
            );
    
            if (!$knock) {
                throw new Exception('Knock request not found', 404);
            }
    
            // Only accept 1 or 0 for accepted parameter
            $accepted = isset($data['accepted']) ? (int)$data['accepted'] === 1 : false;
    
            // Begin transaction
            $this->db->beginTransaction();
    
            try {
                if ($accepted) {
                    // Add user to channel
                    $this->db->insert(
                        "INSERT INTO channel_users (channel_id, user_id, role, joined_at)
                         VALUES (?, ?, 'member', UTC_TIMESTAMP())
                         ON DUPLICATE KEY UPDATE role = 'member'",
                        [$knock['channel_id'], $knock['sender_id']]
                    );
                }
    
                // Delete the knock message
                $this->db->delete(
                    "DELETE FROM messages WHERE id = ? AND is_system = 1",
                    [$data['knock_id']]
                );
    
                $this->db->commit();
                echo json_encode(['success' => true]);
    
            } catch (Exception $e) {
                $this->db->rollBack();
                throw new Exception('Failed to process knock response: ' . $e->getMessage());
            }
        } catch (Exception $e) {
            error_log("Knock response error: " . $e->getMessage());
            http_response_code($e->getCode() ?: 500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
	
    private function handleGetChannelUsers() {
        $channelId = $_GET['channel_id'] ?? null;
        
        if (!$channelId) {
            throw new Exception('Channel ID required', 400);
        }
        
        // Verify channel access
        $channel = $this->db->fetchOne(
            "SELECT * FROM channels WHERE id = ?",
            [$channelId]
        );
        
        if (!$channel) {
            throw new Exception('Channel not found', 404);
        }
        
        $isAdmin = $_SESSION['is_admin'] ?? false;
        $canManage = $isAdmin || $channel['creator_id'] == $_SESSION['user_id'];
        
        if (!$canManage && $channel['is_private']) {
            // Check if user is member
            $isMember = $this->db->fetchOne(
                "SELECT 1 FROM channel_users 
                 WHERE channel_id = ? AND user_id = ?",
                [$channelId, $_SESSION['user_id']]
            );
            
            if (!$isMember) {
                throw new Exception('Access denied', 403);
            }
        }
        
        // Get all current channel users with roles
        $users = $this->db->fetchAll(
            "SELECT 
                u.id,
                u.username,
                u.is_admin,
                cu.role,
                cu.joined_at,
                CASE 
                    WHEN c.creator_id = u.id THEN true
                    ELSE false
                END as is_creator,
                COUNT(m.id) as message_count,
                MAX(m.created_at) as last_activity
             FROM channel_users cu
             JOIN users u ON cu.user_id = u.id
             JOIN channels c ON cu.channel_id = c.id
             LEFT JOIN messages m ON m.channel_id = cu.channel_id AND m.sender_id = u.id
             WHERE cu.channel_id = ? AND u.is_active = TRUE
             GROUP BY u.id
             ORDER BY 
                CASE cu.role
                    WHEN 'admin' THEN 1
                    WHEN 'moderator' THEN 2
                    ELSE 3
                END,
                u.username",
            [$channelId]
        );
        
        // Get available users if user can manage channel
        $availableUsers = [];
        if ($canManage) {
            $availableUsers = $this->db->fetchAll(
                "SELECT 
                    u.id, 
                    u.username, 
                    u.is_admin,
                    EXISTS(
                        SELECT 1 FROM messages m 
                        WHERE m.recipient_id = u.id 
                        AND m.channel_id = ? 
                        AND m.type = 'invitation' 
                        AND m.is_system = 1
                    ) as pending
                 FROM users u
                 WHERE u.id NOT IN (
                     SELECT user_id FROM channel_users WHERE channel_id = ?
                 ) AND u.is_active = TRUE
                 ORDER BY u.username",
                [$channelId, $channelId]
            );
        }
        
        // Return the data as JSON
        echo json_encode([
            'success' => true,
            'data' => [
                'can_manage' => $canManage,
                'users' => $users,
                'available_users' => $availableUsers
            ]
        ]);
    }
    private function handleAssignUser() {
        $data = json_decode(file_get_contents('php://input'), true);
        $channelId = $data['channel_id'] ?? null;
        $userId = $data['user_id'] ?? null;
        $role = $data['role'] ?? 'member';
        
        if (!$channelId || !$userId) {
            throw new Exception('Missing required fields', 400);
        }
        
        if (!in_array($role, ['member', 'moderator', 'admin'])) {
            throw new Exception('Invalid role', 400);
        }
        
       // Verify permissions
$channel = $this->db->fetchOne(
    "SELECT creator_id FROM channels WHERE id = ?",
    [$channelId]
);

if (!$channel || ($channel['creator_id'] != $_SESSION['user_id'] && !$_SESSION['is_admin'])) {
    throw new Exception('Permission denied', 403);
}
        
        if (!$channel) {
            throw new Exception('Channel not found', 404);
        }
        
        if ($channel['creator_id'] != $_SESSION['user_id'] && !$_SESSION['is_admin']) {
            throw new Exception('Permission denied', 403);
        }
        
        // Verify user exists and is active
        $user = $this->db->fetchOne(
            "SELECT * FROM users WHERE id = ? AND is_active = TRUE",
            [$userId]
        );
        
        if (!$user) {
            throw new Exception('User not found', 404);
        }
        
        // Add user to channel
        $this->db->insert(
            "INSERT INTO channel_users (channel_id, user_id, role)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE role = ?",
            [$channelId, $userId, $role, $role]
        );
        
        echo json_encode(['success' => true]);
    }

    private function handleInvite() {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $channelId = $data['channel_id'] ?? null;
            $userId = $data['user_id'] ?? null;
            
            if (!$channelId || !$userId) {
                throw new Exception('Missing required fields', 400);
            }
    
            // Check for existing invitation
            $existing = $this->db->fetchOne(
                "SELECT 1 FROM messages 
                 WHERE channel_id = ? AND recipient_id = ? 
                 AND type = 'invitation' AND is_system = 1",
                [$channelId, $userId]
            );
    
            if ($existing) {
                throw new Exception('Invitation already exists', 400);
            }
    
            // Insert invitation with no content (system message only)
            $this->db->insert(
                "INSERT INTO messages (
                    channel_id, sender_id, recipient_id, type, is_system,
                    created_at, encrypted_content, iv, tag
                ) VALUES (?, ?, ?, 'invitation', 1, 
                         UTC_TIMESTAMP(), '', '', '')",
                [$channelId, $_SESSION['user_id'], $userId]
            );
            
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code($e->getCode() ?: 500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    private function handleRespondInvite() {
        $data = json_decode(file_get_contents('php://input'), true);
        $channelId = $data['channel_id'] ?? null;
        $accepted = $data['accepted'] ?? false;
        
        if (!$channelId) {
            throw new Exception('Missing required fields', 400);
        }
        
        if ($accepted) {
            // Add user to channel
            $this->db->insert(
                "INSERT INTO channel_users (channel_id, user_id, role, joined_at)
                VALUES (?, ?, 'member', UTC_TIMESTAMP())",
                [$channelId, $_SESSION['user_id']]
            );
        }
        
        // Update invitation status
        $this->db->update(
            "UPDATE channel_invitations 
             SET status = ?, responded_at = UTC_TIMESTAMP()
             WHERE channel_id = ? AND user_id = ? AND status = 'pending'",
            [$accepted ? 'accepted' : 'declined', $channelId, $_SESSION['user_id']]
        );
        
        echo json_encode(['success' => true]);
    }


    private function handleInvitationResponse() {
        $data = json_decode(file_get_contents('php://input'), true);
        $messageId = $data['message_id'] ?? null;
        $accepted = $data['accepted'] ?? false;
        
        if (!$messageId) {
            throw new Exception('Message ID required', 400);
        }
        
        // Get the invitation message
        $message = $this->db->fetchOne(
            "SELECT m.*, c.id as channel_id, c.creator_id 
             FROM messages m
             JOIN channels c ON m.channel_id = c.id
             WHERE m.id = ? AND m.type = 'invitation' AND m.recipient_id = ?",
            [$messageId, $_SESSION['user_id']]
        );
        
        if (!$message) {
            throw new Exception('Invitation not found', 404);
        }
        
        // Delete the invitation message
        $this->db->delete(
            "DELETE FROM messages WHERE id = ?",
            [$messageId]
        );
        
        if ($accepted) {
            // Add user to channel
            $this->db->insert(
                "INSERT INTO channel_users (channel_id, user_id, role, joined_at)
                 VALUES (?, ?, 'member', UTC_TIMESTAMP())",
                [$message['channel_id'], $_SESSION['user_id']]
            );
        }
        
        echo json_encode(['success' => true]);
    }

    private function handlePendingInvites() {
        $userId = $_SESSION['user_id'];
        
        $invitations = $this->db->fetchAll(
            "SELECT ci.channel_id, c.name as channel_name
             FROM channel_invitations ci
             JOIN channels c ON ci.channel_id = c.id
             WHERE ci.user_id = ? AND ci.status = 'pending'
             ORDER BY ci.created_at DESC",
            [$userId]
        );
        
        echo json_encode([
            'success' => true,
            'invitations' => $invitations
        ]);
    }

    private function handleRetractInvite() {
        $data = json_decode(file_get_contents('php://input'), true);
        $channelId = $data['channel_id'] ?? null;
        $userId = $data['user_id'] ?? null;
        
        if (!$channelId || !$userId) {
            throw new Exception('Missing required fields', 400);
        }
        
        // Delete only invitation-type messages
        $result = $this->db->delete(
            "DELETE FROM messages 
             WHERE channel_id = ? 
             AND recipient_id = ? 
             AND type = 'invitation' 
             AND is_system = 1
             AND sender_id = ?",
            [$channelId, $userId, $_SESSION['user_id']]
        );
        
        echo json_encode(['success' => true]);
    }

    private function handleListUsers() {
        try {
            $channelId = $_GET['channel_id'] ?? null;
            if (!$channelId) {
                throw new Exception('Channel ID required');
            }
    
            $users = $this->db->fetchAll(
                "SELECT u.id, u.username, cu.role,
                        CASE WHEN u.id = ? THEN 1 ELSE 0 END as is_current_user
                 FROM users u
                 JOIN channel_users cu ON u.id = cu.user_id
                 WHERE cu.channel_id = ?
                 ORDER BY u.username",
                [$_SESSION['user_id'], $channelId]
            );
    
            echo json_encode(['success' => true, 'users' => $users]);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    
    private function handleRemoveUser() {
        $data = json_decode(file_get_contents('php://input'), true);
        $channelId = $data['channel_id'] ?? null;
        $userId = $data['user_id'] ?? null;
    
        error_log("Received remove request: action=remove, channel_id=$channelId, user_id=$userId");
    
        if (!$channelId || !$userId) {
            error_log("Error: Missing required parameters");
            throw new Exception('Missing required parameters', 400);
        }
    
        try {
            $this->db->beginTransaction();
    
            // Verify channel access
            $channel = $this->db->fetchOne(
                "SELECT creator_id FROM channels WHERE id = ?",
                [$channelId]
            );
    
            if (!$channel) {
                throw new Exception('Channel not found', 404);
            }
    
            $isAdmin = $_SESSION['is_admin'] ?? false;
            $canManage = $isAdmin || $channel['creator_id'] == $_SESSION['user_id'];
    
            if (!$canManage) {
                throw new Exception('Permission denied', 403);
            }
    
            if ($userId === $channel['creator_id']) {
                throw new Exception('Cannot remove channel creator', 400);
            }
    
            // First verify the user exists in the channel
            $userExists = $this->db->fetchOne(
                "SELECT 1 FROM channel_users WHERE channel_id = ? AND user_id = ?",
                [$channelId, $userId]
            );
    
            if (!$userExists) {
                throw new Exception('User not found in channel', 404);
            }
    
            // Remove user from the channel
            $affectedRows = $this->db->delete(
                "DELETE FROM channel_users WHERE channel_id = ? AND user_id = ?",
                [$channelId, $userId]
            );
    
            if ($affectedRows === 0) {
                throw new Exception('Failed to remove user from channel');
            }
    
            // Get updated lists after successful removal
            $updatedUsers = $this->db->fetchAll(
                "SELECT u.id, u.username, u.is_admin, cu.role,
                        CASE WHEN c.creator_id = u.id THEN 1 ELSE 0 END as is_creator
                 FROM users u
                 JOIN channel_users cu ON u.id = cu.user_id
                 JOIN channels c ON cu.channel_id = c.id
                 WHERE cu.channel_id = ? AND u.is_active = TRUE
                 ORDER BY u.username",
                [$channelId]
            );
    
            // Delete any pending invitations or system messages for this user in this channel
            $this->db->delete(
                "DELETE FROM messages 
                 WHERE channel_id = ? 
                 AND recipient_id = ? 
                 AND type = 'invitation' 
                 AND is_system = 1",
                [$channelId, $userId]
            );
    
            $this->db->commit();
            
            echo json_encode([
                'success' => true,
                'users' => $updatedUsers
            ]);
            
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Error in handleRemoveUser: " . $e->getMessage());
            throw $e;
        }
    }
}

$handler = new ChannelUserHandler();
$handler->handleRequest();
?>