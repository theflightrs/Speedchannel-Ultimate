<?php
header('Content-Type: application/json');
define('SECURE_ENTRY', true);

require_once(__DIR__ . '/../config.php');
require_once(__DIR__ . '/../Security.php');
require_once(__DIR__ . '/../db_setup.php');

header('Content-Type: application/json');

$security = Security::getInstance();
$db = Database::getInstance();

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Invalid request method');
    }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['action'])) {
        throw new Exception('Invalid request data');
    }

    // In the handleLogin function:
function handleLogin($data, $security, $db) {
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (!$username || !$password) {
        throw new Exception('Username and password are required');
    }

    // Get user from database
    $user = $db->fetchOne(
        "SELECT id, username, password_hash, is_admin, is_active, login_attempts, last_login_attempt 
         FROM users WHERE username = ? AND is_active = 1",
        [$username]
    );

    // User not found or password incorrect
    if (!$user || !$security->verifyPassword($password, $user['password_hash'])) {
        // Increment failed login attempts
        if ($user) {
            $db->update(
                "UPDATE users SET login_attempts = login_attempts + 1, 
                 last_login_attempt = UTC_TIMESTAMP() WHERE id = ?",
                [$user['id']]
            );
        }
        // Use vague message for security
        throw new Exception('Invalid username or password');
    }

    // Check for too many failed attempts
    if ($user['login_attempts'] >= MAX_LOGIN_ATTEMPTS) {
        $lockoutTime = strtotime($user['last_login_attempt']) + LOGIN_TIMEOUT;
        if (time() < $lockoutTime) {
            throw new Exception('Account locked. Try again later.');
        }
    }

    // Success - reset attempts and update last login
    $db->update(
        "UPDATE users SET login_attempts = 0, last_login = UTC_TIMESTAMP() WHERE id = ?",
        [$user['id']]
    );

    // Set session

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['is_admin'] = $user['is_admin'];
    return [
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'is_admin' => $user['is_admin']
        ]
    ];
}

    function handleRegister($data, $security, $db) {
        $db->beginTransaction();
        try {
            $username = trim($data['username'] ?? '');
            $password = $data['password'] ?? '';

            if (!$username || !$password) {
                throw new Exception('Username and password are required');
            }
            
            if (!preg_match('/^[a-zA-Z0-9_]{3,50}$/', $username)) {
                throw new Exception('Invalid username format');
            }

            if (strlen($password) < 6) {
                throw new Exception('Password must be at least 6 characters');
            }

            $existing = $db->fetchOne(
                "SELECT 1 FROM users WHERE username = ?",
                [$username]
            );

            if ($existing) {
                throw new Exception('Username already exists');
            }

            $passwordHash = $security->hashPassword($password);
            
            $userId = $db->insert(
                "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, UTC_TIMESTAMP())",
                [$username, $passwordHash]
            );
            $db->commit();
            return ['success' => true];
        } catch (Exception $e) {
            $db->rollback();
            throw $e;
        }
    }

    function handleLogout() {
        // 1. Clear all session variables first
        $_SESSION = array();
        
        // 2. Delete the session cookie if it exists
        if (isset($_COOKIE[session_name()])) {
            setcookie(session_name(), '', time()-3600, '/', null, true, true);
        }
        
        // 3. Finally destroy the session
        session_destroy();
        
        return ['success' => true];
    }

    // Execute the requested action
    switch ($data['action']) {
        case 'login':
            $result = handleLogin($data, $security, $db);
            break;
        case 'register':
            $result = handleRegister($data, $security, $db);
            break;
        case 'logout':
            $result = handleLogout();
            break;
        default:
            throw new Exception('Invalid action');
    }

    echo json_encode($result);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}