<?php
define('SECURE_ENTRY', true);
require_once('../config.php');
require_once('../Security.php');
require_once('../db_setup.php');

class ApiHandler {
    private $db;
    private $security;
    private $response;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->security = Security::getInstance();
        $this->response = [
            'success' => false,
            'data' => null,
            'error' => null
        ];
    }
	
	function handleMessages($method) {
    error_log("[handleMessages] Method: $method, User ID: {$_SESSION['user_id']}");

    // Existing code for handling messages
}

    public function handleRequest() {
        try {
            // Set security headers
            $this->security->setSecurityHeaders();

            // Initialize session
            $this->security->initSession();

            // Check if the request requires authentication
            if ($this->requiresAuthentication() && !$this->security->isAuthenticated()) {
                throw new Exception('Unauthorized access', 401);
            }

            // Validate CSRF token for POST/PUT/DELETE requests
            if ($this->requiresCSRF()) {
                $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
                if (!$token || !$this->security->validateCSRFToken($token)) {
                    throw new Exception('Invalid CSRF token', 403);
                }
            }

            // Route the request
            $this->routeRequest();

        } catch (Exception $e) {
            $this->response['error'] = $e->getMessage();
            http_response_code($e->getCode() ?: 500);
        }

        // Send response
        header('Content-Type: application/json');
        echo json_encode($this->response);
        exit;
    }
	
	
	

    private function requiresAuthentication() {
        $publicEndpoints = [
            'api/login.php',
            'api/register.php',
            'api/csrf.php'
        ];
        return !in_array($_SERVER['PHP_SELF'], $publicEndpoints);
    }

    private function requiresCSRF() {
        return in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'DELETE']);
    }

    private function routeRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $endpoint = basename($_SERVER['PHP_SELF'], '.php');

        switch ($endpoint) {
            case 'login':
                $this->handleLogin();
                break;
            case 'messages':
                $this->handleMessages($method);
                break;
            case 'channels':
                $this->handleChannels($method);
                break;
            case 'users':
                $this->handleUsers($method);
                break;
            case 'files':
                $this->handleFiles($method);
                break;
            default:
                throw new Exception('Endpoint not found', 404);
        }
    }

    private function handleLogin() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            throw new Exception('Method not allowed', 405);
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? null;
        $password = $data['password'] ?? null;

        if (!$username || !$password) {
            throw new Exception('Missing credentials', 400);
        }

        // Check login attempts
        $user = $this->db->fetchOne(
            "SELECT * FROM users WHERE username = ?",
            [$username]
        );

        if ($user && $user['login_attempts'] >= MAX_LOGIN_ATTEMPTS) {
            $timeout = strtotime($user['last_login_attempt']) + LOGIN_TIMEOUT;
            if (time() < $timeout) {
                throw new Exception('Account temporarily locked. Please try again later.', 429);
            }
            // Reset attempts after timeout
            $this->db->update(
                "UPDATE users SET login_attempts = 0 WHERE id = ?",
                [$user['id']]
            );
        }

        if (!$user || !$this->security->verifyPassword($password, $user['password_hash'])) {
            if ($user) {
                $this->db->update(
                    "UPDATE users SET login_attempts = login_attempts + 1, last_login_attempt = CURRENT_TIMESTAMP WHERE id = ?",
                    [$user['id']]
                );
            }
            throw new Exception('Invalid credentials', 401);
        }

        // Reset login attempts on successful login
        $this->db->update(
            "UPDATE users SET login_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = ?",
            [$user['id']]
        );

        // Set session data
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['is_admin'] = $user['is_admin'];
        $this->security->regenerateSession();

        $this->response['success'] = true;
        $this->response['data'] = [
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'isAdmin' => (bool)$user['is_admin']
            ],
            'csrf_token' => $this->security->generateCSRFToken()
        ];
    }

    private function handleMessages($method) {
        switch ($method) {
            case 'GET':
                $channelId = $_GET['channel_id'] ?? null;
                if (!$channelId) {
                    throw new Exception('Channel ID required', 400);
                }

                // Verify user has access to channel
                $hasAccess = $this->db->fetchOne(
                    "SELECT 1 FROM channel_users WHERE channel_id = ? AND user_id = ?",
                    [$channelId, $_SESSION['user_id']]
                );

                if (!$hasAccess) {
                    throw new Exception('Access denied', 403);
                }

                $messages = $this->db->fetchAll(
                    "SELECT m.*, u.username, f.id as file_id, f.original_name 
                     FROM messages m 
                     JOIN users u ON m.sender_id = u.id 
                     LEFT JOIN files f ON m.id = f.message_id 
                     WHERE m.channel_id = ? 
                     ORDER BY m.created_at DESC 
                     LIMIT ?",
                    [$channelId, MAX_MESSAGES_LOAD]
                );

                $this->response['success'] = true;
                $this->response['data'] = ['messages' => $messages];
                break;

            case 'POST':
                $data = json_decode(file_get_contents('php://input'), true);
                $channelId = $data['channel_id'] ?? null;
                $content = $data['content'] ?? null;

                if (!$channelId || !$content) {
                    throw new Exception('Missing required fields', 400);
                }

                // Start transaction for message and potential file upload
                $this->db->beginTransaction();
                try {
                    // Encrypt message content
                    $encrypted = $this->security->encrypt($content, ENCRYPTION_KEY);
                    
                    $messageId = $this->db->insert(
                        "INSERT INTO messages (channel_id, sender_id, encrypted_content, iv, tag) 
                         VALUES (?, ?, ?, ?, ?)",
                        [
                            $channelId,
                            $_SESSION['user_id'],
                            $encrypted['ciphertext'],
                            $encrypted['iv'],
                            $encrypted['tag']
                        ]
                    );

                    // Handle file upload if present
                    if (isset($_FILES['file'])) {
                        $fileInfo = $this->security->secureUpload($_FILES['file']);
                        $this->db->insert(
                            "INSERT INTO files (message_id, original_name, stored_name, mime_type, file_size) 
                             VALUES (?, ?, ?, ?, ?)",
                            [
                                $messageId,
                                $fileInfo['original_name'],
                                $fileInfo['stored_name'],
                                $fileInfo['mime_type'],
                                $fileInfo['file_size']
                            ]
                        );
                    }

                    $this->db->commit();
                    $this->response['success'] = true;
                    $this->response['data'] = ['message_id' => $messageId];
                } catch (Exception $e) {
                    $this->db->rollBack();
                    throw $e;
                }
                break;

            case 'DELETE':
                $messageId = $_GET['id'] ?? null;
                if (!$messageId) {
                    throw new Exception('Message ID required', 400);
                }

                // Verify user can delete message
                $message = $this->db->fetchOne(
                    "SELECT m.*, c.creator_id 
                     FROM messages m 
                     JOIN channels c ON m.channel_id = c.id 
                     WHERE m.id = ?",
                    [$messageId]
                );

                if (!$message) {
                    throw new Exception('Message not found', 404);
                }

                if ($message['sender_id'] !== $_SESSION['user_id'] && 
                    $message['creator_id'] !== $_SESSION['user_id'] && 
                    !$_SESSION['is_admin']) {
                    throw new Exception('Permission denied', 403);
                }

                // Delete message and associated files
                $this->db->beginTransaction();
                try {
                    // Delete associated files from storage
                    $files = $this->db->fetchAll(
                        "SELECT stored_name FROM files WHERE message_id = ?",
                        [$messageId]
                    );

                    foreach ($files as $file) {
                        unlink(UPLOAD_DIR . $file['stored_name']);
                    }

                    $this->db->delete(
                        "DELETE FROM messages WHERE id = ?",
                        [$messageId]
                    );

                    $this->db->commit();
                    $this->response['success'] = true;
                } catch (Exception $e) {
                    $this->db->rollBack();
                    throw $e;
                }
                break;

            default:
                throw new Exception('Method not allowed', 405);
        }
    }

    // Additional handler methods for channels, users, and files...
}
?>