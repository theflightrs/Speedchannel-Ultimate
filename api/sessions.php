<?php
define('SECURE_ENTRY', true);
require_once(__DIR__ . '/../config.php');
require_once(__DIR__ . '/../Security.php');
require_once(__DIR__ . '/../db_setup.php');

header('Content-Type: application/json');
session_start();

try {
    $security = Security::getInstance();
    
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('No active session', 401);
    }

    if (!isset($_SESSION['is_admin']) || !$_SESSION['is_admin']) {
        throw new Exception('Unauthorized', 403);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $db = Database::getInstance();
        
        // Get current session info
        $data = [
            'id' => session_id(),
            'user_id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'] ?? 'Unknown',
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'last_activity' => date('Y-m-d H:i:s'),
            'is_current' => true,
            'is_admin' => $_SESSION['is_admin'] ?? false,
            'browser' => 'Unknown'
        ];

        if (preg_match('/(chrome|safari|firefox|edge|opera)\s*(\d+)/i', 
            $_SERVER['HTTP_USER_AGENT'] ?? '', $m)) {
            $data['browser'] = ucfirst($m[1]) . " {$m[2]}";
        }

        echo json_encode([
            'success' => true,
            'data' => [$data]
        ]);
        exit;
    }

    throw new Exception('Method not allowed', 405);

} catch (Exception $e) {
    error_log("[Sessions Error] " . $e->getMessage() . "\n" . $e->getTraceAsString());
    http_response_code($e->getCode() ?: 500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}