/* =========================================================================
   Subida y borrado de fotos en Cloudinary, con su SDK oficial.

   Variables de entorno en Vercel:
     CLOUDINARY_CLOUD_NAME
     CLOUDINARY_API_KEY
     CLOUDINARY_API_SECRET
     CLOUDINARY_FOLDER    (opcional, por defecto "calendario")
   ========================================================================= */

const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');

const CARPETA = process.env.CLOUDINARY_FOLDER || 'calendario';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true
});

function configurado() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET);
}

/* Sube una imagen que llega como data URL (data:image/jpeg;base64,...).
   Cloudinary acepta el data URL tal cual. Devuelve la URL https definitiva. */
async function subir(dataUrl, nombreBase) {
  const resultado = await cloudinary.uploader.upload(dataUrl, {
    folder: CARPETA,
    public_id: nombreBase + '-' + crypto.randomBytes(4).toString('hex'),
    resource_type: 'image',
    overwrite: true
  });

  if (!resultado || !resultado.secure_url) {
    throw new Error('Cloudinary no devolvio la URL de la imagen');
  }
  return resultado.secure_url;
}

/* De la URL saca el identificador que Cloudinary necesita para borrarla:
   https://res.cloudinary.com/xxx/image/upload/v1712/calendario/2026-09-21-ab.jpg
                                                  -> calendario/2026-09-21-ab   */
function publicIdDesdeUrl(url) {
  if (!url || url.indexOf('res.cloudinary.com') === -1) return null;
  const m = /\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i.exec(url);
  return m ? m[1] : null;
}

/* Borra una foto. Nunca lanza error: si falla solo queda un archivo huerfano,
   y eso no debe impedir guardar o borrar la salida. */
async function borrar(url) {
  const publicId = publicIdDesdeUrl(url);
  if (!publicId || !configurado()) return false;

  try {
    const r = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    return !!r && r.result === 'ok';
  } catch (e) {
    console.warn('No se pudo borrar la foto de Cloudinary:', e.message);
    return false;
  }
}

module.exports = { configurado, subir, borrar, publicIdDesdeUrl, CARPETA };
