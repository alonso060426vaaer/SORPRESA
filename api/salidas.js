/* =========================================================================
   GET /api/salidas
   Devuelve todas las salidas de la tabla `salidas` en MySQL (Aiven).

   Ojo con la columna `foto`: dentro guarda la imagen entera, y mandarla en
   esta lista haria la respuesta pesadisima. Por eso aqui no va la imagen
   sino su direccion, /api/foto?fecha=...&v=..., y el navegador se la pide
   solo cuando la necesita (y la deja en cache).

   Respuesta:
     { "ok": true, "datos": [ { fecha, titulo, hora, tipo, lugar, nota, foto } ] }
   ========================================================================= */

const { obtenerPool, explicarError, faltaConfiguracion } = require('../lib/db');

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

  const falta = faltaConfiguracion();
  if (falta) return res.status(500).json({ ok: false, error: falta });

  try {
    // DATE_FORMAT devuelve la fecha como texto 'YYYY-MM-DD'. Sin esto el
    // driver la convierte a Date de JavaScript y al pasarla a JSON puede
    // correrse un dia por la zona horaria.
    const [filas] = await obtenerPool().query(
      `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
              titulo, hora, tipo, lugar, nota,
              CASE
                WHEN foto IS NULL OR foto = '' THEN ''
                WHEN foto LIKE 'http%'         THEN foto
                ELSE CONCAT('/api/foto?fecha=', DATE_FORMAT(fecha, '%Y-%m-%d'),
                            '&v=', UNIX_TIMESTAMP(actualizado))
              END AS foto
       FROM salidas
       ORDER BY fecha`
    );

    return res.status(200).json({ ok: true, datos: filas });

  } catch (error) {
    console.error('Error consultando salidas:', error);
    return res.status(500).json({
      ok: false,
      error: explicarError(error) || 'No se pudo consultar la base de datos'
    });
  }
};
