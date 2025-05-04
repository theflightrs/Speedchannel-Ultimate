<?php
define('SECURE_ENTRY', true);
require_once('../config.php');
require_once('../Security.php');

$security = Security::getInstance();
if (!$security->isAdmin()) {
    http_response_code(403);
    exit(json_encode(['success' => false, 'message' => 'Unauthorized']));
}

header('Content-Type: application/json');

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        echo json_encode([
            'success' => true,
            'data' => [
                'features' => [
                    'session_management' => defined('ENABLE_SESSION_MANAGEMENT') ? ENABLE_SESSION_MANAGEMENT : false,
                    'user_search' => defined('ENABLE_USER_SEARCH') ? ENABLE_USER_SEARCH : false,
                    'activity_logging' => defined('ENABLE_ACTIVITY_LOGGING') ? ENABLE_ACTIVITY_LOGGING : false
                ],
                'settings' => [
                    'max_login_attempts' => MAX_LOGIN_ATTEMPTS,
                    'max_file_size' => MAX_FILE_SIZE,
                    'max_files_per_message' => MAX_FILES_PER_MESSAGE
                ]
            ]
        ]);
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || !isset($data['action'])) {
            http_response_code(400);
            exit(json_encode(['success' => false, 'message' => 'Invalid request']));
        }

        if ($data['action'] === 'update_feature') {
            updateConfig($data['feature'], $data['enabled']);
        }

        echo json_encode(['success' => true]);
        break;
}

function updateConfig($key, $value) {
    $config_file = '../config.php';
    $content = file_get_contents($config_file);
    
    $pattern = "/define\s*\(\s*'$key'\s*,\s*(.*?)\s*\);/";
    $replacement = "define('$key', " . ($value ? 'true' : 'false') . ");";
    
    $content = preg_replace($pattern, $replacement, $content);
    file_put_contents($config_file, $content);
}