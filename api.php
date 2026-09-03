<?php
/* =========================================================================
   API del calendario.

     GET   api.php?accion=listar          -> todas las salidas
     POST  api.php  accion=guardar        -> crea o edita una salida
     POST  api.php  accion=borrar         -> borra una salida

   Las fotos llegan como archivo y se guardan en la carpeta uploads/.
   En la base de datos solo se guarda la ruta.
   ========================================================================= */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require __DIR__ . '/db.php';

const CARPETA_FOTOS = 'uploads';
const MAX_FOTO      = 8388608; // 8 MB

function salir($datos, $codigo = 200) {
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

function texto($campo, $largo) {
    $v = isset($_POST[$campo]) ? trim($_POST[$campo]) : '';
    return mb_substr($v, 0, $largo);
}

/* Guarda la imagen subida y devuelve su ruta. Solo acepta imagenes reales:
   se comprueba el contenido del archivo, no el nombre ni lo que diga el
   navegador, para que nadie pueda subir un .php disfrazado. */
function guardarArchivo($archivo, $fecha) {
    if ($archivo['size'] <= 0 || $archivo['size'] > MAX_FOTO) {
        salir(['ok' => false, 'error' => 'La foto pesa mas de 8 MB'], 400);
    }

    $info = @getimagesize($archivo['tmp_name']);
    if (!$info) {
        salir(['ok' => false, 'error' => 'El archivo no es una imagen'], 400);
    }

    $extensiones = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG  => 'png',
        IMAGETYPE_GIF  => 'gif',
        IMAGETYPE_WEBP => 'webp',
    ];
    if (!isset($extensiones[$info[2]])) {
        salir(['ok' => false, 'error' => 'Formato no admitido (usa JPG, PNG o WEBP)'], 400);
    }

    $carpeta = __DIR__ . '/' . CARPETA_FOTOS;
    if (!is_dir($carpeta) && !@mkdir($carpeta, 0775, true)) {
        salir(['ok' => false, 'error' => 'No se pudo crear la carpeta uploads/'], 500);
    }

    $nombre = $fecha . '-' . bin2hex(random_bytes(4)) . '.' . $extensiones[$info[2]];
    if (!move_uploaded_file($archivo['tmp_name'], $carpeta . '/' . $nombre)) {
        salir(['ok' => false, 'error' => 'No se pudo guardar la foto'], 500);
    }

    return CARPETA_FOTOS . '/' . $nombre;
}

/* Borra una foto vieja. Solo toca archivos dentro de uploads/. */
function borrarArchivo($ruta) {
    if (!$ruta || strpos($ruta, CARPETA_FOTOS . '/') !== 0) return;
    $nombre = basename($ruta);
    $lleno  = __DIR__ . '/' . CARPETA_FOTOS . '/' . $nombre;
    if (is_file($lleno)) @unlink($lleno);
}

try {
    $pdo = conectar();
} catch (Throwable $e) {
    salir(['ok' => false, 'error' => 'No hay conexion con la base de datos. Revisa que MySQL este encendido.'], 500);
}

$accion = $_POST['accion'] ?? $_GET['accion'] ?? 'listar';

/* ---------------------------------------------------------------- listar */
if ($accion === 'listar') {
    try {
        $filas = $pdo->query('SELECT fecha, titulo, hora, tipo, lugar, nota, foto
                              FROM salidas ORDER BY fecha')->fetchAll();
        salir(['ok' => true, 'datos' => $filas]);
    } catch (Throwable $e) {
        salir(['ok' => false, 'error' => 'No se pudo leer la tabla salidas'], 500);
    }
}

/* --------------------------------------------------------------- guardar */
if ($accion === 'guardar') {
    $fecha = $_POST['fecha'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        salir(['ok' => false, 'error' => 'Fecha invalida'], 400);
    }

    $titulo = texto('titulo', 120);
    if ($titulo === '') {
        salir(['ok' => false, 'error' => 'Falta el plan'], 400);
    }

    $hora  = texto('hora', 10);
    $tipo  = texto('tipo', 40);
    $lugar = texto('lugar', 120);
    $nota  = texto('nota', 500);
    $foto  = texto('foto', 255);   // ruta que ya tenia, si no cambio

    try {
        $st = $pdo->prepare('SELECT foto FROM salidas WHERE fecha = ?');
        $st->execute([$fecha]);
        $anterior = (string) $st->fetchColumn();

        if (isset($_FILES['archivo']) && $_FILES['archivo']['error'] === UPLOAD_ERR_OK) {
            $foto = guardarArchivo($_FILES['archivo'], $fecha);
            borrarArchivo($anterior);              // la reemplazamos
        } elseif ($foto === '' && $anterior !== '') {
            borrarArchivo($anterior);              // la quitaron
        }

        $sql = 'INSERT INTO salidas (fecha, titulo, hora, tipo, lugar, nota, foto)
                VALUES (:fecha, :titulo, :hora, :tipo, :lugar, :nota, :foto)
                ON DUPLICATE KEY UPDATE
                  titulo = VALUES(titulo), hora  = VALUES(hora),
                  tipo   = VALUES(tipo),   lugar = VALUES(lugar),
                  nota   = VALUES(nota),   foto  = VALUES(foto)';
        $pdo->prepare($sql)->execute([
            ':fecha'  => $fecha,  ':titulo' => $titulo, ':hora'  => $hora,
            ':tipo'   => $tipo,   ':lugar'  => $lugar,  ':nota'  => $nota,
            ':foto'   => $foto,
        ]);

        salir(['ok' => true, 'foto' => $foto]);
    } catch (Throwable $e) {
        salir(['ok' => false, 'error' => 'No se pudo guardar'], 500);
    }
}

/* ---------------------------------------------------------------- borrar */
if ($accion === 'borrar') {
    $fecha = $_POST['fecha'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        salir(['ok' => false, 'error' => 'Fecha invalida'], 400);
    }
    try {
        $st = $pdo->prepare('SELECT foto FROM salidas WHERE fecha = ?');
        $st->execute([$fecha]);
        borrarArchivo((string) $st->fetchColumn());

        $pdo->prepare('DELETE FROM salidas WHERE fecha = ?')->execute([$fecha]);
        salir(['ok' => true]);
    } catch (Throwable $e) {
        salir(['ok' => false, 'error' => 'No se pudo borrar'], 500);
    }
}

salir(['ok' => false, 'error' => 'Accion desconocida'], 400);
