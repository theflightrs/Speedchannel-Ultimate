<?php
define('SECURE_ENTRY', true);
require_once('../config.php');
require_once('../Security.php');
require_once('../db_setup.php');

class ActivityLogger {
    private $db;
    private static $instance = null;
    
    private function __construct() {
        $this->db = Database::getInstance();
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function log($type, $action, $details, $severity = 'info') {
        if (!ENABLE_ACTIVITY_LOGGING) {
            return;
        }
        
        $userId = $_SESSION['user_id'] ?? null;
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
        
        $this->db->insert(
            "INSERT INTO activity_logs 
             (user_id, type, action, details, severity, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                $userId,
                $type,
                $action,
                json_encode($details),
                $severity,
                $ipAddress,
                $userAgent
            ]
        );
    }
}

class ActivityLogHandler {
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
            
            if (!ENABLE_ACTIVITY_LOGGING) {
                throw new Exception('Activity logging is disabled', 403);
            }
            
            switch ($_SERVER['REQUEST_METHOD']) {
                case 'GET':
                    $this->handleGetLogs();
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
    
    private function handleGetLogs() {
        $date = $_GET['date'] ?? date('Y-m-d');
        $type = $_GET['type'] ?? '';
        $severity = $_GET['severity'] ?? '';
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = 50;
        
        $query = "
            SELECT 
                l.*,
                u.username
            FROM activity_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE DATE(l.created_at) = ?
        ";
        
        $params = [$date];
        
        if ($type) {
            $query .= " AND l.type = ?";
            $params[] = $type;
        }
        
        if ($severity) {
            $query .= " AND l.severity = ?";
            $params[] = $severity;
        }
        
        $query .= " ORDER BY l.created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = ($page - 1) * $limit;
        
        $logs = $this->db->fetchAll($query, $params);
        
        // Process log details
        foreach ($logs as &$log) {
            $log['details'] = json_decode($log['details'], true);
        }
        
        // Get total count for pagination
        $countQuery = "
            SELECT COUNT(*) as count 
            FROM activity_logs 
            WHERE DATE(created_at) = ?
        ";
        $countParams = [$date];
        
        if ($type) {
            $countQuery .= " AND type = ?";
            $countParams[] = $type;
        }
        
        if ($severity) {
            $countQuery .= " AND severity = ?";
            $countParams[] = $severity;
        }
        
        $totalCount = $this->db->fetchOne($countQuery, $countParams)['count'];
        
        echo json_encode([
            'success' => true,
            'data' => [
                'logs' => $logs,
                'pagination' => [
                    'current_page' => $page,
                    'total_pages' => ceil($totalCount / $limit),
                    'total_results' => $totalCount
                ]
            ]
        ]);
    }
}

// Handle both logging and retrieving logs
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $handler = new ActivityLogHandler();
    $handler->handleRequest();
}
?>