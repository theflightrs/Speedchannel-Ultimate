<?php
define('SECURE_ENTRY', true);
require_once(__DIR__ . '/../config.php');
require_once(__DIR__ . '/../Security.php');
require_once(__DIR__ . '/../db_setup.php');

header('Content-Type: application/json');
session_start();

try {
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['is_admin']) || !$_SESSION['is_admin']) {
        throw new Exception('Unauthorized', 403);
    }

    $db = Database::getInstance();

    // Handle POST actions
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $postData = json_decode(file_get_contents('php://input'), true);
        if (!$postData) {
            throw new Exception('Invalid JSON data');
        }

        if ($postData['action'] === 'delete' && isset($postData['user_id'])) {
            $userId = intval($postData['user_id']);
            
            if ($userId === $_SESSION['user_id']) {
                throw new Exception('Cannot delete your own account');
            }

            try {
                $db->beginTransaction();
            
                // Delete from channel_users (uses user_id)
                $db->delete(
                    "DELETE FROM channel_users WHERE user_id = ?",
                    [$userId]
                );
            
                // Delete user's messages (uses sender_id based on messages.php)
                $db->delete(
                    "DELETE FROM messages WHERE sender_id = ?",
                    [$userId]
                );
            
                // Delete channels created by user (uses creator_id based on channels.php)
                $db->delete(
                    "DELETE FROM channels WHERE creator_id = ?",
                    [$userId]
                );
            
                // Finally delete the user (uses id)
                $db->delete(
                    "DELETE FROM users WHERE id = ?",
                    [$userId]
                );
            
                $db->commit();
                echo json_encode(['success' => true]);
                return;
            
            } catch (Exception $e) {
                $db->rollBack();
                throw new Exception('Failed to delete user: ' . $e->getMessage());
            }
        }
    }

    // GET request handling for user search
    $query = "SELECT id, username, email, is_admin, is_active, last_login, created_at 
              FROM users WHERE 1=1";
    $params = [];

    if (!empty($_GET['q'])) {
        $search = "%" . trim($_GET['q']) . "%";
        $query .= " AND (username LIKE ? OR email LIKE ?)";
        $params[] = $search;
        $params[] = $search;
    }

    if (!empty($_GET['role'])) {
        $query .= " AND is_admin = ?";
        $params[] = ($_GET['role'] === 'admin') ? 1 : 0;
    }

    if (!empty($_GET['status'])) {
        $query .= " AND is_active = ?";
        $params[] = ($_GET['status'] === 'active') ? 1 : 0;
    }

    $query .= " ORDER BY " . match($_GET['sort'] ?? 'username') {
        'last_login' => 'last_login DESC NULLS LAST',
        'created' => 'created_at DESC',
        'role' => 'is_admin DESC, username ASC',
        default => 'username ASC'
    };

    $users = $db->fetchAll($query, $params);
    echo json_encode(['success' => true, 'data' => ['users' => $users]]);

} catch (Exception $e) {
    error_log("[User Search] " . $e->getMessage());
    http_response_code($e->getCode() ?: 500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}