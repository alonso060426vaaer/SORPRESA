-- Tabla `salidas` para la base `defaultdb` de Aiven.
-- `foto` es mediumtext porque la imagen se guarda aqui dentro, no en un servicio aparte.
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
