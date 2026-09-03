/* =========================================================================
   GET /api/foto?fecha=2026-09-02&v=1756...

   Devuelve la imagen de esa salida. La foto vive en la propia base de datos
   (columna `foto`, como data URL), asi que no hace falta ningun servicio de
   imagenes aparte.

   El parametro v es la marca de tiempo de la ultima edicion: cambia cuando
   cambia la foto, y por eso podemos decirle al navegador que la guarde para
   siempre en cache sin miedo a que se quede con la vieja.
   ========================================================================= */

const { obtenerPool, faltaConfiguracion } = require('../lib/db');

// data:image/jpeg;base64,/9j/4AAQ...
const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  }

  const falta = faltaConfiguracion();
  if (falta) return res.status(500).json({ ok: false, error: falta });

  const fecha = typeof req.query.fecha === 'string' ? req.query.fecha.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ ok: false, error: 'Fecha invalida' });
  }

  try {
    const [filas] = await obtenerPool().query(
      'SELECT foto FROM salidas WHERE fecha = ?', [fecha]
    );

    const foto = filas.length ? (filas[0].foto || '') : '';
    if (!foto) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ ok: false, error: 'Esa salida no tiene foto' });
    }

    const partes = DATA_URL.exec(foto);
    if (!partes) {
      // por si quedo guardada una direccion de las de antes
      res.setHeader('Cache-Control', 'no-store');
      return res.status(409).json({ ok: false, error: 'La foto no esta guardada en la base de datos' });
    }

    const imagen = Buffer.from(partes[2], 'base64');

    res.setHeader('Content-Type', partes[1]);
    res.setHeader('Content-Length', imagen.length);
    // la direccion lleva ?v= con la fecha de edicion, asi que nunca se repite
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(imagen);

  } catch (error) {
    console.error('Error leyendo la foto:', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ ok: false, error: 'No se pudo leer la foto' });
  }
};
