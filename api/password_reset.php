<?php
define('SECURE_ENTRY', true);
require_once('../config.php');
require_once('../Security.php');
require_once('../db_setup.php');

class PasswordResetHandler {
    private $db;
    private $security;
    
    public function __construct() {
        $this->db = Database::getInstance();
        $this->security = Security::getInstance();
    }
    
    public function handleRequest() {
        header('Content-Type: application/json');
        
        try {
            switch ($_SERVER['REQUEST_METHOD']) {
                case 'POST':
                    if (isset($_GET['action'])) {
                        switch ($_GET['action']) {
                            case 'request':
                                $this->handleResetRequest();
                                break;
                            case 'verify':
                                $this->handleVerifyToken();
                                break;
                            case 'reset':
                                $this->handlePasswordReset();
                                break;
                            default:
                                throw new Exception('Invalid action', 400);
                        }
                    } else {
                        throw new Exception('Action required', 400);
                    }
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
    
    private function handleResetRequest() {
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? null;
        
        if (!$username) {
            throw new Exception('Username required', 400);
        }
        
        // Get user
        $user = $this->db->fetchOne(
            "SELECT * FROM users WHERE username = ? AND is_active = TRUE",
            [$username]
        );
        
        if ($user) {
            // Generate reset token
            $token = bin2hex(random_bytes(32));
            $expires = date('Y-m-d H:i:s', time() + PASSWORD_RESET_TIMEOUT);
            
            // Store token
            $this->db->update(
                "UPDATE users 
                 SET reset_token = ?, reset_token_expires = ? 
                 WHERE id = ?",
                [$token, $expires, $user['id']]
            );
            
            // Send email
            $resetLink = "https://yourdomain.com/reset-password?token=" . $token;
            $to = $user['email'];
            $subject = "Password Reset Request";
            $message = "
                Hi {$user['username']},
                
                You recently requested to reset your password. Click the link below to reset it:
                
                {$resetLink}
                
                This link will expire in 1 hour.
                
                If you didn't request this, please ignore this email.
                
                Best regards,
                SecureChat Team
            ";
            
            $headers = [
                'From' => MAIL_FROM_NAME . ' <' . MAIL_FROM . '>',
                'Content-Type' => 'text/html; charset=UTF-8'
            ];
            
            mail($to, $subject, nl2br($message), $headers);
        }
        
        // Always return success to prevent username enumeration
        echo json_encode(['success' => true]);
    }
    
    private function handleVerifyToken() {
        $data = json_decode(file_get_contents('php://input'), true);
        $token = $data['token'] ?? null;
        
        if (!$token) {
            throw new Exception('Token required', 400);
        }
        
        $user = $this->db->fetchOne(
            "SELECT id FROM users 
             WHERE reset_token = ? 
             AND reset_token_expires > NOW() 
             AND is_active = TRUE",
            [$token]
        );
        
        echo json_encode([
            'success' => true,
            'data' => ['valid' => (bool)$user]
        ]);
    }
    
    private function handlePasswordReset() {
        $data = json_decode(file_get_contents('php://input'), true);
        $token = $data['token'] ?? null;
        $password = $data['password'] ?? null;
        
        if (!$token || !$password) {
            throw new Exception('Missing required fields', 400);
        }
        
        if (strlen($password) < 6) {
            throw new Exception('Password must be at least 6 characters', 400);
        }
        
        // Verify token and update password
        $user = $this->db->fetchOne(
            "SELECT id FROM users 
             WHERE reset_token = ? 
             AND reset_token_expires > NOW() 
             AND is_active = TRUE",
            [$token]
        );
        
        if (!$user) {
            throw new Exception('Invalid or expired token', 400);
        }
        
        // Update password and clear reset token
        $this->db->update(
            "UPDATE users 
             SET password_hash = ?, 
                 reset_token = NULL, 
                 reset_token_expires = NULL 
             WHERE id = ?",
            [$this->security->hashPassword($password), $user['id']]
        );
        
        echo json_encode(['success' => true]);
    }
}

$handler = new PasswordResetHandler();
$handler->handleRequest();
?>