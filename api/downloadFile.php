<?php
define('UPLOAD_DIR', realpath(__DIR__ . '/../uploads/') . DIRECTORY_SEPARATOR);
define('ENCRYPTION_KEY', 'your-secure-random-key-here'); // Replace with a securely generated key
define('ENCRYPTION_ALGORITHM', 'aes-256-gcm');

function decryptFile($encryptedFilePath, $iv, $tag, $key) {
    $ciphertext = file_get_contents($encryptedFilePath);

    return openssl_decrypt(
        $ciphertext,
        ENCRYPTION_ALGORITHM,
        $key,
        0,
        hex2bin($iv),
        hex2bin($tag)
    );
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $fileId = $_GET['file_id'] ?? null;

    if (!$fileId) {
        http_response_code(400);
        echo json_encode(['message' => 'File ID is required']);
        exit;
    }

    // Replace with actual database fetch logic
    $fileData = fetchFileMetadata($fileId);
    if (!$fileData) {
        http_response_code(404);
        echo json_encode(['message' => 'File not found']);
        exit;
    }

    $decryptedData = decryptFile(
        UPLOAD_DIR . $fileData['stored_name'],
        $fileData['iv'],
        $fileData['tag'],
        ENCRYPTION_KEY
    );

    if ($decryptedData === false) {
        http_response_code(500);
        echo json_encode(['message' => 'Failed to decrypt file']);
        exit;
    }

    header('Content-Type: ' . $fileData['mime_type']);
    header('Content-Disposition: attachment; filename="' . $fileData['original_name'] . '"');
    echo $decryptedData;
} else {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
}
?>