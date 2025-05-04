<?php
define('SECURE_ENTRY', true);
require_once(__DIR__ . '/../config.php');
require_once(__DIR__ . '/../Security.php');

session_start(); // Make sure session is started

header('Content-Type: application/json');

// Debug the session state
error_log("Session state: " . print_r($_SESSION, true));

if (!isset($_SESSION['is_admin'])) {
    error_log("No admin session set");
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Not logged in as admin']);
    exit;
}

if (!$_SESSION['is_admin']) {
    error_log("User not admin");
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Insufficient privileges']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $configFile = file_get_contents(__DIR__ . '/../config.php');
    preg_match_all("/define\('([^']+)',\s*([^)]+)\)/", $configFile, $matches);
    
    $settings = [];
    for ($i = 0; $i < count($matches[1]); $i++) {
        $key = $matches[1][$i];
        $value = trim($matches[2][$i]);
        
        // Skip sensitive settings
        if (strpos($key, 'KEY') !== false || 
            strpos($key, 'SECRET') !== false || 
            strpos($key, 'PASSWORD') !== false) {
            continue;
        }

        error_log("Found setting: $key = $value");

        // Determine value type
        if ($value === 'true' || $value === 'false') {
            $type = 'boolean';
        } elseif (is_numeric($value)) {
            $type = 'number';
        } else {
            $type = 'text';
        }
        
        $settings[$key] = [
            'value' => constant($key),
            'type' => $type
        ];
    }
    
    echo json_encode(['success' => true, 'settings' => $settings]);
}