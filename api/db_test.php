<?php
require_once(__DIR__ . '/../config.php');
require_once(__DIR__ . '/../Security.php');
require_once(__DIR__ . '/../db_setup.php');

$db = Database::getInstance();

try {
    $result = $db->query("SELECT 1");
    echo "Database connection successful\n";
    
    // Try to insert a test channel
    $channelId = $db->insert(
        "INSERT INTO channels (name, creator_id, is_private, created_at) 
         VALUES (?, ?, ?, UTC_TIMESTAMP())",
        ['test_channel', 1, true]
    );
    echo "Channel insertion successful, ID: " . $channelId;
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>