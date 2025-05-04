<?php
define('SECURE_ENTRY', true);
require_once(__DIR__ . '/../config.php');
require_once(__DIR__ . '/../Security.php');
require_once(__DIR__ . '/../db_setup.php');

header('Content-Type: application/json');
session_start();

try {
    // Using your existing security check
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['is_admin']) || !$_SESSION['is_admin']) {
        throw new Exception('Unauthorized', 403);
    }

    $db = Database::getInstance();
    
    // Enhanced query with all necessary user fields
    $query = "SELECT id, username, email, is_admin, is_active, last_login, created_at 
              FROM users WHERE 1=1";
    $params = [];

    // Search by username/email with trimmed input
    if (!empty($_GET['q'])) {
        $search = "%" . trim($_GET['q']) . "%";
        $query .= " AND (username LIKE ? OR email LIKE ?)";
        $params[] = $search;
        $params[] = $search;
    }

    // Role filter using is_admin field
    if (!empty($_GET['role'])) {
        $query .= " AND is_admin = ?";
        $params[] = ($_GET['role'] === 'admin') ? 1 : 0;
    }

    // Filter by status
    if (!empty($_GET['status'])) {
        $query .= " AND is_active = ?";
        $params[] = ($_GET['status'] === 'active') ? 1 : 0;
    }

    // Enhanced sorting with NULLS LAST for last_login
    $query .= " ORDER BY " . match($_GET['sort'] ?? 'username') {
        'last_login' => 'last_login DESC NULLS LAST',
        'created' => 'created_at DESC',
        'role' => 'is_admin DESC, username ASC',
        default => 'username ASC'
    };

    // Using your existing database fetch method
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