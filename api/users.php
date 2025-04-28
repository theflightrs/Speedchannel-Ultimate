<?php
define('SECURE_ENTRY', true);  // Add this first
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json');
require_once('../config.php');
require_once('../Security.php');
require_once('../db_setup.php');

// Start output buffering
ob_start();;

// Capture all output to prevent corruption of JSON response
ob_start();

try {
    // Debugging: Log request method and session state
    error_log("[users.php] Request method: " . $_SERVER['REQUEST_METHOD']);
    error_log("[users.php] Session ID: " . session_id());
    error_log("[users.php] User ID in session: " . ($_SESSION['user_id'] ?? 'None'));

    // Validate session: Ensure the user is authenticated
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401); // Not authenticated
        echo json_encode(['success' => false, 'error' => 'Not authenticated']);
        exit;
    }

    $security = Security::getInstance();
    $db = Database::getInstance();

    $action = $_GET['action'] ?? 'current';

    switch ($action) {
        case 'current':
            fetchCurrentUser($db);
            break;

        case 'list':
            listUsers($db);
            break;

        default:
            throw new Exception('Invalid action', 400);
    }
} catch (Exception $e) {
    // Log errors and return them as JSON
    error_log("[users.php] Error: " . $e->getMessage());
    http_response_code($e->getCode() ?: 400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
} finally {
    // Ensure no stray output corrupts JSON
    ob_end_flush();
}

function fetchCurrentUser($db) {
    $user = $db->fetchOne(
        "SELECT id, username, is_admin FROM users WHERE id = ?",
        [$_SESSION['user_id']]
    );
    echo json_encode(['success' => true, 'user' => $user]);
}

function listUsers($db) {
    $users = $db->fetchAll(
        "SELECT id, username, is_admin, is_active,
                last_login > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE) as is_online
         FROM users
         ORDER BY username"
    );
    echo json_encode(['success' => true, 'users' => $users]);
}