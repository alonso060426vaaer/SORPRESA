/* =========================================================================
   GET /api/salidas
   Serverless Function de Vercel (Node.js) que consulta la tabla `salidas`
   en MySQL de Aiven y la devuelve como JSON.

   Variables de entorno (Vercel -> Settings -> Environment Variables):
     AIVEN_PASSWORD   (obligatoria)
     AIVEN_HOST, AIVEN_PORT, AIVEN_USER, AIVEN_DATABASE  (opcionales,
     ya tienen los valores de tu proyecto como respaldo)

   Respuesta:
     { "ok": true, "datos": [ { fecha, titulo, hora, tipo, lugar, nota, foto } ] }
   ========================================================================= */

const mysql = require('mysql2/promise');

// El pool se guarda fuera del handler: mientras Vercel mantenga "caliente"
// la funcion, las siguientes llamadas reaprovechan la conexion en vez de
// abrir una nueva cada vez (Aiven limita las conexiones simultaneas).
let pool;

function obtenerPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:     process.env.AIVEN_HOST     || 'mysql-2acfd6e9-kelvincampana06-e3b0.h.aivencloud.com',
      port:     Number(process.env.AIVEN_PORT || 26500),
      user:     process.env.AIVEN_USER     || 'avnadmin',
      password: process.env.AIVEN_PASSWORD,
      database: process.env.AIVEN_DATABASE || 'defaultdb',

      // Aiven exige TLS. Lo ideal es validar con su certificado CA, pero
      // aqui va como lo pediste.
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

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  }

  if (!process.env.AIVEN_PASSWORD) {
    return res.status(500).json({
      ok: false,
      error: 'Falta la variable de entorno AIVEN_PASSWORD en Vercel'
    });
  }

  try {
    // DATE_FORMAT devuelve la fecha como texto 'YYYY-MM-DD'. Sin esto el
    // driver la convierte a Date de JavaScript y al pasarla a JSON puede
    // correrse un dia por la zona horaria.
    const [filas] = await obtenerPool().query(
      `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
              titulo, hora, tipo, lugar, nota, foto
       FROM salidas
       ORDER BY fecha`
    );

    return res.status(200).json({ ok: true, datos: filas });

  } catch (error) {
    console.error('Error consultando salidas:', error);

    // Errores tipicos, para no adivinar desde el navegador
    let detalle = 'No se pudo consultar la base de datos';
    if (error.code === 'ER_NO_SUCH_TABLE')      detalle = 'La tabla `salidas` no existe en defaultdb';
    if (error.code === 'ER_ACCESS_DENIED_ERROR') detalle = 'Usuario o contrasena incorrectos';
    if (error.code === 'ETIMEDOUT')              detalle = 'La base de datos no responde (revisa host y puerto)';

    return res.status(500).json({ ok: false, error: detalle });
  }
};
