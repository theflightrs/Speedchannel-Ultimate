<?php

// Prevent direct access
if (!defined('SECURE_ENTRY')) {
    die('Direct access not permitted');
}
// Database configuration
// Enter your credentials between ''
define('DB_HOST', '');
define('DB_USER', '');
define('DB_PASSWORD', '');
define('DB_NAME', '');
define('DB_PORT', 3306);

// Optional Features
define('ENABLE_USER_SEARCH', false);
define('ENABLE_SESSION_MANAGEMENT', false);
define('ENABLE_ACTIVITY_LOGGING', false);

// Password reset settings
define('PASSWORD_RESET_TIMEOUT', 3600); // 1 hour
define('MAIL_FROM', 'noreply@yourdomain.com');
define('MAIL_FROM_NAME', 'Speedchannel');

// Security configuration
define('SESSION_LIFETIME', 3600); // 1 hour
define('CSRF_TIMEOUT', 7200);     // 2 hours
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOGIN_TIMEOUT', 900);     // 15 minutes
define('ENCRYPTION_ALGORITHM', 'aes-256-gcm');
define('HASH_ALGO', PASSWORD_ARGON2ID);
define('ENCRYPTION_KEY', 'your-secure-random-key-here');

// File upload configuration
define('UPLOAD_DIR', realpath(__DIR__ . '/uploads/') . DIRECTORY_SEPARATOR);
define('MAX_FILE_SIZE', 5242880); // 5MB
define('ALLOWED_MIME_TYPES', [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain'
]);

// Channel configuration
define('MAX_CHANNELS_PER_USER', 10);
define('MAX_MESSAGES_LOAD', 50);

// Error reporting in development
define('DEV_MODE', false);
if (DEV_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

?>
