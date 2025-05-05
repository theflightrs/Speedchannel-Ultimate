<?php
define('SECURE_ENTRY', true);
require_once(__DIR__ . '/../config.php');
require_once(__DIR__ . '/../Security.php');

session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['is_admin']) || !$_SESSION['is_admin']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Not logged in as admin']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $configFile = file_get_contents(__DIR__ . '/../config.php');
    preg_match_all("/define\('([^']+)',\s*([^)]+)\)/", $configFile, $matches);
    
    $settings = [];
    $excludedSettings = [
        'DB_HOST', 'DB_USER', 'DB_PORT', 'DB_PASSWORD', 'DB_NAME',
        'UPLOAD_DIR', 'ENCRYPTION_KEY', 'HASH_ALGO', 'ENCRYPTION_ALGORITHM',
         'AUTO_URL', 'CSRF_TIMEOUT', 'ENABLE_USER_SEARCH', 'ENABLE_SESSION_MANAGEMENT', 'ENABLE_ACTIVITY_LOGGING', 'ALLOWED_MIME_TYPES'
    ];

    for ($i = 0; $i < count($matches[1]); $i++) {
        $key = $matches[1][$i];
        if (in_array($key, $excludedSettings)) continue;

        $value = trim($matches[2][$i]);
        $type = 'text';
        
        if ($value === 'true' || $value === 'false') {
            $type = 'boolean';
        } elseif (is_numeric($value)) {
            $type = 'number';
        }
        
        $settings[$key] = [
            'value' => constant($key),
            'type' => $type
        ];
    }
    
    echo json_encode(['success' => true, 'settings' => $settings]);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['logo'])) {
        try {
            $file = $_FILES['logo'];
            $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
            $newName = 'logo.' . $ext;
            
            if (move_uploaded_file($file['tmp_name'], __DIR__ . '/../' . $newName)) {
                $configFile = file_get_contents(__DIR__ . '/../config.php');
                $pattern = "/define\('SITE_LOGO',\s*[^;]+;/";
                $replacement = "define('SITE_LOGO', '$newName');";
                file_put_contents(__DIR__ . '/../config.php', preg_replace($pattern, $replacement, $configFile));
                echo json_encode(['success' => true]);
            } else {
                throw new Exception('Failed to upload logo');
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!isset($data['settings'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No settings provided']);
        exit;
    }

    try {
        $configFile = file_get_contents(__DIR__ . '/../config.php');
        
        foreach ($data['settings'] as $key => $value) {
            if (in_array($key, ['UPLOAD_DIR', 'DB_PASSWORD', 'DB_USER', 'DB_NAME', 'DB_HOST'])) {
                continue;
            }
            
            $value = is_bool($value) ? ($value ? 'true' : 'false') : 
                     (is_numeric($value) ? (string)$value : "'$value'");
            
            $pattern = "/define\('$key',\s*[^;]+;/";
            $replacement = "define('$key', $value);";
            $configFile = preg_replace($pattern, $replacement, $configFile);
        }
        
        if (file_put_contents(__DIR__ . '/../config.php', $configFile)) {
            echo json_encode(['success' => true]);
        } else {
            throw new Exception('Failed to write config file');
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}