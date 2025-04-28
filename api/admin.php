<?php
define('SECURE_ENTRY', true);
require_once(__DIR__ . '/../config.php');
require_once(__DIR__ . '/../Security.php');
require_once(__DIR__ . '/../db_setup.php');

header('Content-Type: application/json');

$security = Security::getInstance();
$db = Database::getInstance();

if (!$security->isAuthenticated() || !$_SESSION['is_admin']) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

try {
    $action = $_GET['action'] ?? '';
    
    switch($action) {
        case 'sessions':
            getSessions();
            break;
        case 'logs':
            getActivityLogs();
            break;
        case 'stats':
            getSystemStats();
            break;
        case 'terminate_session':
            terminateSession();
            break;
        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function getSessions() {
    global $db;
    
    $sessions = $db->fetchAll(
        "SELECT s.*, u.username 
         FROM sessions s
         INNER JOIN users u ON s.user_id = u.id
         WHERE s.last_activity > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
         ORDER BY s.last_activity DESC"
    );

    echo json_encode([
        'success' => true,
        'sessions' => $sessions
    ]);
}

function getActivityLogs() {
    global $db;
    
    $date = $_GET['date'] ?? date('Y-m-d');
    $type = $_GET['type'] ?? '';
    $severity = $_GET['severity'] ?? '';

    $query = "SELECT * FROM activity_logs WHERE DATE(created_at) = ?";
    $params = [$date];

    if ($type) {
        $query .= " AND type = ?";
        $params[] = $type;
    }

    if ($severity) {
        $query .= " AND severity = ?";
        $params[] = $severity;
    }

    $query .= " ORDER BY created_at DESC LIMIT 1000";

    $logs = $db->fetchAll($query, $params);

    echo json_encode([
        'success' => true,
        'logs' => $logs
    ]);
}

function getSystemStats() {
    global $db;
    
    $stats = [
        'users' => $db->fetchOne("SELECT COUNT(*) as count FROM users")['count'],
        'active_users' => $db->fetchOne(
            "SELECT COUNT(*) as count FROM users 
             WHERE last_login > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)"
        )['count'],
        'channels' => $db->fetchOne("SELECT COUNT(*) as count FROM channels")['count'],
        'messages_today' => $db->fetchOne(
            "SELECT COUNT(*) as count FROM messages 
             WHERE DATE(created_at) = CURDATE()"
        )['count'],
        'files' => $db->fetchOne("SELECT COUNT(*) as count FROM files")['count'],
        'total_storage' => $db->fetchOne(
            "SELECT SUM(file_size) as total FROM files"
        )['total'] ?? 0
    ];

    echo json_encode([
        'success' => true,
        'stats' => $stats
    ]);
}

function terminateSession() {
    global $db;
    
    $sessionId = $_POST['session_id'] ?? null;
    if (!$sessionId) throw new Exception('Session ID required');

    $db->delete(
        "DELETE FROM sessions WHERE id = ? AND user_id != ?",
        [$sessionId, $_SESSION['user_id']] // Prevent terminating own session
    );

    echo json_encode(['success' => true]);
}