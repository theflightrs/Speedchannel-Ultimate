<?php
require_once('config.php');

class Security {
    private static $instance = null;
    
    private function __construct() {
        $this->initSession();
        $this->setSecurityHeaders();
        $this->checkSessionSecurity();
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function initSession() {
        if (session_status() === PHP_SESSION_NONE) {
            // Keep only essential settings
            ini_set('session.cookie_httponly', 1);
            ini_set('session.use_only_cookies', 1);
            
            session_start();
            
            if (!isset($_SESSION['created'])) {
                $_SESSION['created'] = time();
                $_SESSION['last_activity'] = time();
            }
        }
    }

    private function setSecurityHeaders() {
        // Only keep essential security headers
        header("X-XSS-Protection: 1; mode=block");
        header("X-Content-Type-Options: nosniff");
        // Remove strict headers that might cause issues
        // header("Content-Security-Policy: default-src 'self'");
        // header("X-Frame-Options: DENY");
        // header("Strict-Transport-Security: max-age=31536000; includeSubDomains");
    }
    
    private function checkSessionSecurity() {
        if (isset($_SESSION['last_activity']) && 
            (time() - $_SESSION['last_activity'] > SESSION_LIFETIME)) {
            $this->logout();
            header('Location: index.php');
            exit();
        }
        $this->updateLastActivity();
    }

    public function getLoginVisibility() {
        return !$this->isAuthenticated() ? '' : 'hidden';
    }
    
    public function getAuthVisibility() {
        return $this->isAuthenticated() ? '' : 'hidden';
    }

    // Authentication Methods
    public function isAuthenticated() {
        return isset($_SESSION['user_id']);
    }

    public function logout() {
        $_SESSION = array();
        if (isset($_COOKIE[session_name()])) {
            setcookie(session_name(), '', time()-3600, '/', '', true, true);        }
        session_destroy();
    }

    // CSRF Protection
    public function generateCSRFToken() {
        if (!isset($_SESSION['csrf_token']) || 
            !isset($_SESSION['csrf_token_expires']) || 
            time() >= $_SESSION['csrf_token_expires']) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            $_SESSION['csrf_token_expires'] = time() + CSRF_TIMEOUT;
        }
        return $_SESSION['csrf_token'];
    }

    public function validateCSRFToken($token) {
        return isset($_SESSION['csrf_token']) &&
               isset($_SESSION['csrf_token_expires']) &&
               hash_equals($_SESSION['csrf_token'], $token) &&
               time() < $_SESSION['csrf_token_expires'];
    }

    // Encryption Methods
    public function encrypt($data, $key) {
        $iv = random_bytes(16);
        $tag = '';
        
        $ciphertext = openssl_encrypt(
            $data,
            ENCRYPTION_ALGORITHM,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );
        
        return [
            'ciphertext' => base64_encode($ciphertext),
            'iv' => bin2hex($iv),
            'tag' => bin2hex($tag)
        ];
    }

    public function decrypt($ciphertext, $iv, $tag, $key) {
        return openssl_decrypt(
            base64_decode($ciphertext),
            ENCRYPTION_ALGORITHM,
            $key,
            OPENSSL_RAW_DATA,
            hex2bin($iv),
            hex2bin($tag)
        );
    }

    // Password Methods
    public function hashPassword($password) {
        return password_hash($password, PASSWORD_ARGON2ID, [
            'memory_cost' => 65536,
            'time_cost' => 4,
            'threads' => 3
        ]);
    }

    public function verifyPassword($password, $hash) {
        return password_verify($password, $hash);
    }

    // File Upload Methods
    public function validateFileUpload($file) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('File upload failed');
        }

        if ($file['size'] > MAX_FILE_SIZE) {
            throw new Exception('File too large');
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);

        if (!in_array($mimeType, ALLOWED_MIME_TYPES)) {
            throw new Exception('Invalid file type');
        }

        return true;
    }

    public function secureUpload($file) {
        if (!$this->validateFileUpload($file)) {
            return false;
        }

        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $storedName = bin2hex(random_bytes(16)) . '.' . $extension;
        $uploadPath = UPLOAD_DIR . $storedName;

        if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
            throw new Exception('Failed to save file');
        }

        return [
            'original_name' => $file['name'],
            'stored_name' => $storedName,
            'mime_type' => $file['type'],
            'file_size' => $file['size']
        ];
    }

    private function updateLastActivity() {
        $_SESSION['last_activity'] = time();
    }
}