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
    
    // First, ensure current session is in database
    $db->query(
        "REPLACE INTO sessions 
         (id, user_id, ip_address, user_agent, last_activity, csrf_token, csrf_token_expires) 
         VALUES (?, ?, ?, ?, NOW(), ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))",
        [
            session_id(),
            $_SESSION['user_id'],
            $_SERVER['REMOTE_ADDR'],
            $_SERVER['HTTP_USER_AGENT'],
            bin2hex(random_bytes(32)) // csrf_token
        ]
    );

    // Then retrieve all sessions
    $sessions = $db->fetchAll(
        "SELECT s.*, u.username, u.is_admin 
         FROM sessions s 
         JOIN users u ON s.user_id = u.id 
         WHERE s.last_activity > DATE_SUB(NOW(), INTERVAL 24 HOUR)
         ORDER BY s.last_activity DESC"
    );

    echo json_encode([
        'success' => true,
        'data' => array_map(function($session) {
            return [
                'id' => $session['id'],
                'username' => $session['username'],
                'ip_address' => $session['ip_address'],
                'browser' => preg_match('/(chrome|safari|firefox|edge|opera)\s*(\d+)/i', 
                    $session['user_agent'], $m) ? ucfirst($m[1]) . " {$m[2]}" : 'Unknown',
                'last_activity' => $session['last_activity'],
                'is_current' => ($session['id'] === session_id()),
                'is_admin' => (bool)$session['is_admin']
            ];
        }, $sessions)
    ]);

} catch (Exception $e) {
    error_log("[Sessions Error] " . $e->getMessage() . "\n" . $e->getTraceAsString());
    http_response_code($e->getCode() ?: 500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}