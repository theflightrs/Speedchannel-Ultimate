<?php
define('SECURE_ENTRY', true);
require_once('../config.php');
require_once('../Security.php');
require_once('../db_setup.php');

class UserSearchHandler {
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
            
            if (!ENABLE_USER_SEARCH && !$_SESSION['is_admin']) {
                throw new Exception('Advanced search is disabled', 403);
            }
            
            switch ($_SERVER['REQUEST_METHOD']) {
                case 'GET':
                    $this->handleSearch();
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
    
    private function handleSearch() {
        $search = $_GET['q'] ?? '';
        $role = $_GET['role'] ?? '';
        $status = $_GET['status'] ?? '';
        $sort = $_GET['sort'] ?? 'username';
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = 20;
        
        $query = "
            SELECT 
                u.id,
                u.username,
                u.is_admin,
                u.created_at,
                u.last_login,
                u.is_active,
                COUNT(DISTINCT cu.channel_id) as channel_count,
                COUNT(DISTINCT m.id) as message_count,
                MAX(m.created_at) as last_message
            FROM users u
            LEFT JOIN channel_users cu ON u.id = cu.user_id
            LEFT JOIN messages m ON u.id = m.sender_id
        ";
        
        $whereConditions = [];
        $params = [];
        
        if ($search) {
            $whereConditions[] = "u.username LIKE ?";
            $params[] = "%{$search}%";
        }
        
        if ($role === 'admin') {
            $whereConditions[] = "u.is_admin = TRUE";
        } elseif ($role === 'user') {
            $whereConditions[] = "u.is_admin = FALSE";
        }
        
        if ($status === 'active') {
            $whereConditions[] = "u.is_active = TRUE";
        } elseif ($status === 'inactive') {
            $whereConditions[] = "u.is_active = FALSE";
        }
        
        if (!empty($whereConditions)) {
            $query .= " WHERE " . implode(" AND ", $whereConditions);
        }
        
        $query .= " GROUP BY u.id";
        
        $query .= " ORDER BY " . match($sort) {
            'created_at' => 'u.created_at DESC',
            'last_login' => 'u.last_login DESC NULLS LAST',
            'last_message' => 'last_message DESC NULLS LAST',
            default => 'u.username'
        };
        
        $query .= " LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = ($page - 1) * $limit;
        
        // Get total count for pagination
        $countQuery = preg_replace('/SELECT .* FROM/', 'SELECT COUNT(DISTINCT u.id) as count FROM', 
                                 substr($query, 0, strpos($query, 'GROUP BY')));
        $totalCount = $this->db->fetchOne($countQuery, array_slice($params, 0, -2))['count'];
        
        $users = $this->db->fetchAll($query, $params);
        
        echo json_encode([
            'success' => true,
            'data' => [
                'users' => $users,
                'pagination' => [
                    'current_page' => $page,
                    'total_pages' => ceil($totalCount / $limit),
                    'total_results' => $totalCount
                ]
            ]
        ]);
    }
}

$handler = new UserSearchHandler();
$handler->handleRequest();
?>