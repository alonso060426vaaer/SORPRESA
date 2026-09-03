/* =========================================================================
   POST /api/guardar
   Crea o edita una salida en MySQL (Aiven). La foto se guarda dentro de la
   misma base de datos, en la columna `foto`, tal cual llega del navegador
   (data URL). El navegador ya la reduce a 900px y JPEG al 72%, asi que pesa
   unos 150 KB: cabe de sobra y nos ahorra depender de un servicio externo.

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
                                            - "/api/foto?fecha=..."         deja la que ya tenia
                                            - ""                            sin foto / la quitaron
     }

   Respuesta: { "ok": true, "foto": "/api/foto?fecha=2026-10-08&v=1756..." }
   ========================================================================= */

const { obtenerPool, explicarError, faltaConfiguracion } = require('../lib/db');

const LARGOS = { titulo: 120, hora: 10, tipo: 40, lugar: 120, nota: 500 };

// Vercel corta las peticiones de mas de 4,5 MB, y una imagen en base64 ocupa
// un tercio mas que el archivo. Cortamos antes para dar un mensaje claro.
const MAX_FOTO = 3500000;

const DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/i;

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

  const fotoEntrante = typeof datos.foto === 'string' ? datos.foto.trim() : '';
  const esFotoNueva  = fotoEntrante.startsWith('data:');

  if (esFotoNueva) {
    if (!DATA_URL.test(fotoEntrante)) {
      return res.status(400).json({ ok: false, error: 'El archivo no es una imagen' });
    }
    if (fotoEntrante.length > MAX_FOTO) {
      return res.status(413).json({ ok: false, error: 'La foto pesa demasiado, intenta con otra' });
    }
  }

  try {
    const pool = obtenerPool();

    let foto;
    if (esFotoNueva) {
      foto = fotoEntrante;                 // la nueva reemplaza a la anterior
    } else if (!fotoEntrante) {
      foto = '';                           // la quitaron
    } else {
      // llego la direccion de la que ya tenia: no la tocamos
      const [previas] = await pool.query('SELECT foto FROM salidas WHERE fecha = ?', [fecha]);
      foto = previas.length ? (previas[0].foto || '') : '';
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

    // devolvemos la direccion de la foto, no la foto: es lo que el calendario
    // pone en el <img>, y el ?v= hace que se vea la nueva y no la de antes
    let direccion = '';
    if (foto) {
      const [marca] = await pool.query(
        'SELECT UNIX_TIMESTAMP(actualizado) AS v FROM salidas WHERE fecha = ?', [fecha]
      );
      const v = marca.length ? marca[0].v : Math.floor(Date.now() / 1000);
      direccion = '/api/foto?fecha=' + fecha + '&v=' + v;
    }

    return res.status(200).json({ ok: true, foto: direccion });

  } catch (error) {
    console.error('Error guardando salida:', error);
    if (error.code === 'ER_DATA_TOO_LONG') {
      return res.status(500).json({
        ok: false,
        error: 'La columna `foto` todavia es corta: vuelve a correr crear-tabla.js'
      });
    }
    return res.status(500).json({
      ok: false,
      error: explicarError(error) || error.message || 'No se pudo guardar'
    });
  }
};
