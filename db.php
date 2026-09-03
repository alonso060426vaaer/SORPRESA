<?php
/* =========================================================================
   Conexion a la base de datos.

   En XAMPP normalmente no hay que tocar nada: usuario "root" y sin clave.
   Cuando lo subas a un hosting, cambia estos 4 datos por los que te den
   en su panel (suelen estar en "Bases de datos MySQL").
   ========================================================================= */

$DB_HOST = '127.0.0.1';
$DB_PORT = 3308;          // este XAMPP usa 3308, no el 3306 de siempre
$DB_NAME = 'calendario';
$DB_USER = 'root';
$DB_PASS = '';

function conectar() {
    global $DB_HOST, $DB_PORT, $DB_NAME, $DB_USER, $DB_PASS;

    $dsn = "mysql:host=$DB_HOST;port=$DB_PORT;dbname=$DB_NAME;charset=utf8mb4";
    return new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
}
