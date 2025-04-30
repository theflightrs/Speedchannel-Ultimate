<?php

define('SECURE_ENTRY', true);
require_once('../config.php');
require_once('../Security.php');
require_once('../db_setup.php');

// After requires, before class definition
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/knock_error.log');

// Inside handleRequest(), before the switch:
error_log("Received request: " . print_r([
    'method' => $_SERVER['REQUEST_METHOD'],
    'input' => file_get_contents('php://input')
], true));


class ChannelUserHandler {
    private $db;
    private $security;
    
    public function __construct() {
        $this->db = Database::getInstance();
        $this->security = Security::getInstance();
    }
    
    public function handleRequest() {
        header('Content-Type: application/json');
        
        try {
            if (!$this->security->isAuthenticated()) {
                throw new Exception('Unauthorized access', 401);
            }
            
            $data = json_decode(file_get_contents('php://input'), true);
            $action = $data['action'] ?? '';
            
            switch ($_SERVER['REQUEST_METHOD']) {
                case 'GET':
                    $this->handleGetChannelUsers();
                    break;
                    
                    case 'POST':
                        switch ($action) {
                            case 'knock':
                                $this->handleKnock();
                                break;
                            case 'knock_response':
                                $this->handleKnockResponse();
                                break;
                            default:
                                $this->handleAssignUser();
                        }
                        break;
                        case 'list':  // Add this case
                            $this->handleListUsers();
                            break;
                case 'DELETE':
                    $this->handleRemoveUser();
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
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Knock ID required']);
                return;
            }
    
            try {
                $knock = $this->db->fetchOne(
                    "SELECT m.id, m.sender_id, c.id as channel_id, c.creator_id 
                     FROM messages m
                     JOIN channels c ON m.channel_id = c.id
                     WHERE m.id = ? AND m.is_system = 1",
                    [$data['knock_id']]
                );
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database query failed']);
                return;
            }
    
            if (!$knock) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Knock request not found']);
                return;
            }
    
            // First delete the knock message
            $this->db->delete(
                "DELETE FROM messages WHERE id = ? AND is_system = 1",
                [$data['knock_id']]
            );
    
            // Then if accepted, add to channel
            if ($data['accepted']) {
                try {
                    $this->db->insert(
                        "INSERT IGNORE INTO channel_users (channel_id, user_id, role, joined_at)
                        VALUES (?, ?, 'member', UTC_TIMESTAMP())",
                        [$knock['channel_id'], $knock['sender_id']]
                    );
                } catch (PDOException $e) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Failed to add user to channel']);
                    return;
                }
            }
    
            echo json_encode(['success' => true]);
    
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Internal server error']);
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
        
        // Get channel users with roles
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
             LEFT JOIN messages m ON m.channel_id = c.id AND m.sender_id = u.id
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
                "SELECT id, username, is_admin
                 FROM users
                 WHERE id NOT IN (
                     SELECT user_id FROM channel_users WHERE channel_id = ?
                 ) AND is_active = TRUE
                 ORDER BY username",
                [$channelId]
            );
        }
        
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
    
        if (!$channelId || !$userId) {
            throw new Exception('Missing required parameters');
        }
    
        // Check permissions
        $channel = $this->db->fetchOne(
            "SELECT creator_id FROM channels WHERE id = ?",
            [$channelId]
        );
    
        if (!$channel || ($channel['creator_id'] !== $_SESSION['user_id'] && !$_SESSION['is_admin'])) {
            throw new Exception('Permission denied');
        }
    
        // Cannot remove channel creator
        if ($userId === $channel['creator_id']) {
            throw new Exception('Cannot remove channel creator');
        }
    
        $this->db->delete(
            "DELETE FROM channel_users WHERE channel_id = ? AND user_id = ?",
            [$channelId, $userId]
        );
    
        echo json_encode(['success' => true]);
    }
}

$handler = new ChannelUserHandler();
$handler->handleRequest();
?>