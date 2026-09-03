/* =========================================================================
   Prepara la tabla `salidas` en la base defaultdb de Aiven.
   Se corre desde tu PC:   node crear-tabla.js

   Se puede repetir sin miedo: si la tabla ya existe no la toca, y si la
   columna `foto` se quedo corta (era varchar(255), de cuando las fotos iban
   a Cloudinary) la agranda para que quepa la imagen entera.

   Pide la contrasena por teclado y no la muestra ni la guarda en ningun
   lado, asi que no queda en el historial de la consola.
   ========================================================================= */

const mysql    = require('mysql2/promise');
const readline = require('readline');

const CONEXION = {
  host: process.env.AIVEN_HOST || 'mysql-2acfd6e9-kelvincampana06-e3b0.h.aivencloud.com',
  port: Number(process.env.AIVEN_PORT || 26500),
  user: process.env.AIVEN_USER || 'avnadmin',
  database: process.env.AIVEN_DB || 'defaultdb',
  ssl: { rejectUnauthorized: false }
};

const TABLA = `
CREATE TABLE IF NOT EXISTS salidas (
  fecha       date         NOT NULL,
  titulo      varchar(120) NOT NULL,
  hora        varchar(10)  NOT NULL DEFAULT '',
  tipo        varchar(40)  NOT NULL DEFAULT '',
  lugar       varchar(120) NOT NULL DEFAULT '',
  nota        varchar(500) NOT NULL DEFAULT '',
  foto        mediumtext   NOT NULL,
  actualizado timestamp    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

/* Lee la contrasena sin que aparezca en pantalla */
function pedirContrasena() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write('Contrasena de avnadmin (no se vera al escribir): ');
    rl._writeToOutput = () => {};                 // silencia el eco
    rl.question('', respuesta => {
      rl.close();
      process.stdout.write('\n');
      resolve(respuesta.trim());
    });
  });
}

(async () => {
  const password = process.env.AIVEN_PASSWORD || await pedirContrasena();
  if (!password) {
    console.error('No escribiste ninguna contrasena.');
    process.exit(1);
  }

  let conexion;
  try {
    console.log('Conectando a ' + CONEXION.host + ':' + CONEXION.port + ' ...');
    conexion = await mysql.createConnection({ ...CONEXION, password });

    await conexion.query(TABLA);
    console.log('Tabla `salidas` lista.');

    // si la tabla venia de antes, la columna `foto` es varchar(255) y no le
    // entra una imagen: la agrandamos sin tocar lo que ya haya guardado
    const [columnas] = await conexion.query("SHOW COLUMNS FROM salidas LIKE 'foto'");
    if (columnas.length && !/mediumtext/i.test(columnas[0].Type)) {
      await conexion.query('ALTER TABLE salidas MODIFY foto mediumtext NOT NULL');
      console.log('Columna `foto` agrandada: ahora guarda la imagen dentro de la base.');
    }

    const [filas] = await conexion.query('SELECT COUNT(*) AS total FROM salidas');
    console.log('Filas guardadas ahora mismo: ' + filas[0].total);
    console.log('\nListo, ya puedes subir fotos desde el celular.');

  } catch (error) {
    if (error.code === 'ER_ACCESS_DENIED_ERROR') console.error('\nContrasena o usuario incorrectos.');
    else if (error.code === 'ETIMEDOUT')         console.error('\nNo se llego al servidor: revisa host y puerto.');
    else                                          console.error('\nError: ' + error.message);
    process.exitCode = 1;

  } finally {
    if (conexion) await conexion.end();
  }
})();
