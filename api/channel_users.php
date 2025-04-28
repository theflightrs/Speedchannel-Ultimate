<?php
define('SECURE_ENTRY', true);
require_once('../config.php');
require_once('../Security.php');
require_once('../db_setup.php');

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
                    if ($action === 'knock') {
                        $this->handleKnock();
                    } else {
                        $this->handleAssignUser();
                    }
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
    
    // Create knock message
    $this->db->insert(
        "INSERT INTO messages (channel_id, sender_id, encrypted_content, iv, tag, is_system)
         VALUES (?, ?, ?, ?, ?, TRUE)",
        [
            $channelId,
            $_SESSION['user_id'],
            "User {$_SESSION['username']} is knocking", // You might want to encrypt this
            '', // IV for encryption
            '', // Tag for encryption
        ]
    );
    
    echo json_encode(['success' => true]);
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
    
    private function handleRemoveUser() {
        $channelId = $_GET['channel_id'] ?? null;
        $userId = $_GET['user_id'] ?? null;
        
        if (!$channelId || !$userId) {
            throw new Exception('Missing required fields', 400);
        }
        
        // Verify permissions
        $channel = $this->db->fetchOne(
            "SELECT * FROM channels WHERE id = ?",
            [$channelId]
        );
        
        if (!$channel) {
            throw new Exception('Channel not found', 404);
        }
        
        if ($channel['creator_id'] != $_SESSION['user_id'] && !$_SESSION['is_admin']) {
            throw new Exception('Permission denied', 403);
        }
        
        // Cannot remove channel creator
        if ($channel['creator_id'] == $userId) {
            throw new Exception('Cannot remove channel creator', 400);
        }
        
        // Remove user from channel
        $this->db->delete(
            "DELETE FROM channel_users 
             WHERE channel_id = ? AND user_id = ?",
            [$channelId, $userId]
        );
        
        echo json_encode(['success' => true]);
    }
}

$handler = new ChannelUserHandler();
$handler->handleRequest();
?>