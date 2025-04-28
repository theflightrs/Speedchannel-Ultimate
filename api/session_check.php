<?php
require_once('../Security.php');
$security = Security::getInstance();

header('Content-Type: application/json');
session_start();

if ($security->isAuthenticated()) {
    echo json_encode(['success' => true, 'user' => $_SESSION['user']]);
} else {
    echo json_encode(['success' => false]);
}