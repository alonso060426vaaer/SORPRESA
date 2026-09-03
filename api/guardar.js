/* =========================================================================
   POST /api/guardar
   Crea o edita una salida en MySQL (Aiven). Si llega una foto nueva, primero
   la sube a Cloudinary y guarda la URL definitiva en la columna `foto`.

   Cuerpo esperado (JSON):
     {
       "fecha":  "2026-10-08",              obligatorio
       "titulo": "Cine y cena",             obligatorio
       "hora":   "19:00",
       "tipo":   "Cine",
       "lugar":  "Centro",
       "nota":   "...",
       "foto":   ""                         una de estas tres:
                                            - "data:image/jpeg;base64,..."  foto nueva
                                            - "https://res.cloudinary..."   la que ya tenia
                                            - ""                            sin foto / la quitaron
     }

   Respuesta: { "ok": true, "foto": "https://res.cloudinary.com/..." }
   ========================================================================= */

const { obtenerPool, explicarError, faltaConfiguracion } = require('../lib/db');
const nube = require('../lib/cloudinary');

const LARGOS = { titulo: 120, hora: 10, tipo: 40, lugar: 120, nota: 500 };

function texto(valor, largo) {
  if (typeof valor !== 'string') return '';
  return valor.trim().slice(0, largo);
}

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

  // Vercel ya entrega el JSON parseado, pero si llega como texto lo leemos igual
  let datos = req.body;
  if (typeof datos === 'string') {
    try { datos = JSON.parse(datos); }
    catch (e) { return res.status(400).json({ ok: false, error: 'JSON invalido' }); }
  }
  if (!datos || typeof datos !== 'object') {
    return res.status(400).json({ ok: false, error: 'Faltan los datos de la salida' });
  }

  const fecha = typeof datos.fecha === 'string' ? datos.fecha.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ ok: false, error: 'Fecha invalida (formato AAAA-MM-DD)' });
  }

  const titulo = texto(datos.titulo, LARGOS.titulo);
  if (!titulo) {
    return res.status(400).json({ ok: false, error: 'Falta el plan' });
  }

  const hora  = texto(datos.hora,  LARGOS.hora);
  const tipo  = texto(datos.tipo,  LARGOS.tipo);
  const lugar = texto(datos.lugar, LARGOS.lugar);
  const nota  = texto(datos.nota,  LARGOS.nota);
  const fotoEntrante = typeof datos.foto === 'string' ? datos.foto : '';

  try {
    const pool = obtenerPool();

    // que foto tenia antes, para poder reemplazarla o borrarla de Cloudinary
    const [previas] = await pool.query('SELECT foto FROM salidas WHERE fecha = ?', [fecha]);
    const fotoAnterior = previas.length ? (previas[0].foto || '') : '';

    let foto = fotoEntrante;

    if (fotoEntrante.startsWith('data:')) {
      // foto nueva: va a Cloudinary
      if (!nube.configurado()) {
        return res.status(500).json({
          ok: false,
          error: 'Faltan las variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en Vercel'
        });
      }
      foto = await nube.subir(fotoEntrante, fecha);
      if (fotoAnterior && fotoAnterior !== foto) await nube.borrar(fotoAnterior);

    } else if (!fotoEntrante && fotoAnterior) {
      // la quitaron
      await nube.borrar(fotoAnterior);
      foto = '';
    }

    if (foto.length > 255) {
      return res.status(400).json({ ok: false, error: 'La URL de la foto es demasiado larga' });
    }

    await pool.query(
      `INSERT INTO salidas (fecha, titulo, hora, tipo, lugar, nota, foto)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         titulo = VALUES(titulo), hora  = VALUES(hora),
         tipo   = VALUES(tipo),   lugar = VALUES(lugar),
         nota   = VALUES(nota),   foto  = VALUES(foto)`,
      [fecha, titulo, hora, tipo, lugar, nota, foto]
    );

    return res.status(200).json({ ok: true, foto: foto });

  } catch (error) {
    console.error('Error guardando salida:', error);
    return res.status(500).json({
      ok: false,
      error: explicarError(error) || error.message || 'No se pudo guardar'
    });
  }
};
