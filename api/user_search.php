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

        $action = $postData['action'] ?? '';
        $userId = intval($postData['user_id'] ?? 0);

        if ($action === 'delete' && $userId > 0) {
            // Prevent self-deletion
            if ($userId === $_SESSION['user_id']) {
                throw new Exception('Cannot delete yourself');
            }

            $db->beginTransaction();
            try {
                // Delete user
                $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
                $result = $stmt->execute([$userId]);
                
                if (!$result) {
                    throw new Exception('Failed to delete user');
                }
                
                if ($stmt->rowCount() === 0) {
                    throw new Exception('User not found');
                }

                $db->commit();
                echo json_encode(['success' => true]);
                exit;
            } catch (Exception $e) {
                $db->rollBack();
                throw $e;
            }
        }
    }

    // Rest of your existing GET query code...
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

    echo json_encode([
        'success' => true,
        'data' => ['users' => $users]
    ]);

} catch (Exception $e) {
    error_log("[User Search] " . $e->getMessage());
    http_response_code($e->getCode() ?: 500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}