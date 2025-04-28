<?php
session_start();
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.use_only_cookies', 1);
header('Content-Type: application/json');
require_once('../config.php');
require_once('../Security.php');
require_once('../db_setup.php');

$security = Security::getInstance();
$db = Database::getInstance();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

if ($action === 'check') {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false]);
        exit;
    }
    $user = $db->fetchOne("SELECT * FROM users WHERE id = ?", [$_SESSION['user_id']]);
    echo json_encode(['success' => true, 'user' => $user]);
}

class SessionHandler {
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
            
            if (!$_SESSION['is_admin']) {
                throw new Exception('Admin access required', 403);
            }
            
            if (!ENABLE_SESSION_MANAGEMENT) {
                throw new Exception('Session management is disabled', 403);
            }
            
            switch ($_SERVER['REQUEST_METHOD']) {
                case 'GET':
                    $this->handleGetSessions();
                    break;
                    
                case 'DELETE':
                    $this->handleTerminateSession();
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
    
    private function handleGetSessions() {
        $search = $_GET['search'] ?? '';
        $sort = $_GET['sort'] ?? 'last_activity';
        
        $query = "
            SELECT 
                s.id as session_id,
                s.user_id,
                s.ip_address,
                s.user_agent,
                s.last_activity,
                u.username,
                u.is_admin
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.last_activity > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ";
        
        $params = [];
        
        if ($search) {
            $query .= " AND u.username LIKE ?";
            $params[] = "%{$search}%";
        }
        
        $query .= " ORDER BY " . match($sort) {
            'ip_address' => 's.ip_address',
            'user_agent' => 's.user_agent',
            default => 's.last_activity DESC'
        };
        
        $sessions = $this->db->fetchAll($query, $params);
        
        // Process user agents
        foreach ($sessions as &$session) {
            $session['browser_info'] = $this->parseBrowserInfo($session['user_agent']);
            $session['is_current'] = ($session['session_id'] === session_id());
        }
        
        echo json_encode([
            'success' => true,
            'data' => ['sessions' => $sessions]
        ]);
    }
    
    private function handleTerminateSession() {
        $sessionId = $_GET['id'] ?? null;
        
        if (!$sessionId) {
            throw new Exception('Session ID required', 400);
        }
        
        // Cannot terminate own session
        if ($sessionId === session_id()) {
            throw new Exception('Cannot terminate your own session', 400);
        }
        
        // Delete session
        $this->db->delete(
            "DELETE FROM sessions WHERE id = ?",
            [$sessionId]
        );
        
        echo json_encode(['success' => true]);
    }
    
    private function parseBrowserInfo($userAgent) {
        $browser = "Unknown";
        $platform = "Unknown";
        
        // Basic browser detection
        if (preg_match('/(chrome|safari|firefox|edge|opera|msie|trident(?=\/))\/?\s*(\d+)/i', $userAgent, $matches)) {
            $browser = ucfirst($matches[1]) . " {$matches[2]}";
        }
        
        // Basic platform detection
        if (preg_match('/(windows|macintosh|linux|android|iphone|ipad)/i', $userAgent, $matches)) {
            $platform = ucfirst($matches[1]);
        }
        
        return [
            'browser' => $browser,
            'platform' => $platform,
            'raw' => $userAgent
        ];
    }
}

$handler = new SessionHandler();
$handler->handleRequest();
?>