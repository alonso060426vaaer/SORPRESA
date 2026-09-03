/* =========================================================================
   Conexion compartida a MySQL (Aiven) para todas las funciones de /api.

   Vive fuera de /api a proposito: los archivos dentro de /api se convierten
   en rutas publicas, y esto es solo un modulo interno.

   Variables de entorno en Vercel:
     AIVEN_HOST, AIVEN_PORT, AIVEN_USER, AIVEN_PASSWORD, AIVEN_DB
   ========================================================================= */

const mysql = require('mysql2/promise');

// Fuera del handler: mientras Vercel mantenga la funcion "caliente", las
// siguientes llamadas reaprovechan la conexion. Aiven limita las conexiones
// simultaneas, asi que esto importa.
let pool;

function obtenerPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:     process.env.AIVEN_HOST || 'mysql-2acfd6e9-kelvincampana06-e3b0.h.aivencloud.com',
      port:     Number(process.env.AIVEN_PORT || 26500),
      user:     process.env.AIVEN_USER || 'avnadmin',
      password: process.env.AIVEN_PASSWORD,
      database: process.env.AIVEN_DB || process.env.AIVEN_DATABASE || 'defaultdb',

      ssl: { rejectUnauthorized: false },

      waitForConnections: true,
      connectionLimit: 3,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });
  }
  return pool;
}

/* Traduce los errores de MySQL a algo entendible en pantalla */
function explicarError(error) {
  if (error && error.code === 'ER_NO_SUCH_TABLE')       return 'La tabla `salidas` no existe en la base de datos';
  if (error && error.code === 'ER_ACCESS_DENIED_ERROR') return 'Usuario o contrasena de Aiven incorrectos';
  if (error && error.code === 'ETIMEDOUT')              return 'La base de datos no responde (revisa host y puerto)';
  if (error && error.code === 'ER_DATA_TOO_LONG')       return 'Algun campo es demasiado largo';
  return null;
}

/* Comprueba que este cargada la contrasena antes de intentar nada */
function faltaConfiguracion() {
  if (!process.env.AIVEN_PASSWORD) {
    return 'Falta la variable de entorno AIVEN_PASSWORD en Vercel';
  }
  return null;
}

module.exports = { obtenerPool, explicarError, faltaConfiguracion };
