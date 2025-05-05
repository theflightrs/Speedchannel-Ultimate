public function insert($query, $params = []) {
    $stmt = $this->pdo->prepare($query);
    $stmt->execute($params);
    return $this->pdo->lastInsertId();
}