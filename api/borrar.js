/* =========================================================================
   POST /api/borrar
   Elimina una salida de MySQL (Aiven). La foto vive dentro de la misma fila,
   asi que se borra con ella y no queda nada suelto.

   Cuerpo esperado (JSON):  { "fecha": "2026-10-08" }
   Respuesta:               { "ok": true, "borradas": 1 }
   ========================================================================= */

const { obtenerPool, explicarError, faltaConfiguracion } = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  }

  const falta = faltaConfiguracion();
  if (falta) return res.status(500).json({ ok: false, error: falta });

  let datos = req.body;
  if (typeof datos === 'string') {
    try { datos = JSON.parse(datos); }
    catch (e) { return res.status(400).json({ ok: false, error: 'JSON invalido' }); }
  }

  const fecha = datos && typeof datos.fecha === 'string' ? datos.fecha.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ ok: false, error: 'Fecha invalida (formato AAAA-MM-DD)' });
  }

  try {
    const pool = obtenerPool();

    const [resultado] = await pool.query('DELETE FROM salidas WHERE fecha = ?', [fecha]);

    // si no estaba, para el calendario el resultado es el mismo
    return res.status(200).json({ ok: true, borradas: resultado.affectedRows });

  } catch (error) {
    console.error('Error borrando salida:', error);
    return res.status(500).json({
      ok: false,
      error: explicarError(error) || error.message || 'No se pudo borrar'
    });
  }
};
