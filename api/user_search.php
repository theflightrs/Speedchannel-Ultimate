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
    
    $query = "SELECT id, username, email, is_admin, is_active, last_login, created_at 
              FROM users WHERE 1=1";
    $params = [];

    // Search by username/email
    if (!empty($_GET['q'])) {
        $query .= " AND (username LIKE ? OR email LIKE ?)";
        $search = "%" . $_GET['q'] . "%";
        $params[] = $search;
        $params[] = $search;
    }

    // Filter by role
    if (!empty($_GET['role'])) {
        $query .= " AND is_admin = ?";
        $params[] = ($_GET['role'] === 'admin') ? 1 : 0;
    }

    // Filter by status
    if (!empty($_GET['status'])) {
        $query .= " AND is_active = ?";
        $params[] = ($_GET['status'] === 'active') ? 1 : 0;
    }

    // Sort
    $query .= " ORDER BY " . match($_GET['sort'] ?? 'username') {
        'last_login' => 'last_login DESC NULLS LAST',
        'created' => 'created_at DESC',
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