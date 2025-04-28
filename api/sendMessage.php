<?php
require_once '../db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $message = $_POST['message'] ?? '';
    $channelId = $_POST['channel_id'] ?? null;
    $senderId = $_SESSION['user_id'] ?? null;

    if (!$channelId || !$senderId || empty($message)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid request']);
        exit;
    }

    try {
        $db = Database::getInstance();
        $conn = $db->getConnection();

        // Insert message
        $stmt = $conn->prepare("INSERT INTO messages (channel_id, sender_id, encrypted_content, iv, tag, has_attachment) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$channelId, $senderId, $message, '', '', !empty($_FILES)]);

        $messageId = $conn->lastInsertId();

        // Handle file uploads
        foreach ($_FILES as $file) {
            $originalName = $file['name'];
            $storedName = uniqid() . '_' . $originalName;
            $mimeType = $file['type'];
            move_uploaded_file($file['tmp_name'], "../uploads/$storedName");

            $stmt = $conn->prepare("INSERT INTO files (message_id, original_name, stored_name, mime_type, iv, tag) VALUES (?, ?, ?, ?, '', '')");
            $stmt->execute([$messageId, $originalName, $storedName, $mimeType]);
        }

        echo json_encode(['success' => true, 'message' => 'Message sent']);
    } catch (Exception $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Internal server error']);
    }
}