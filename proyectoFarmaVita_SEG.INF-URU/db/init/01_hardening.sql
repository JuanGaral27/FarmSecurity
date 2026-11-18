-- =====================================================================
--  FarmaVita · Inicialización y endurecimiento de PostgreSQL
--  Se ejecuta una sola vez al crear el volumen de datos.
--  Las tablas de negocio las crea TypeORM (synchronize: true).
-- =====================================================================

-- Zona horaria de trazabilidad (Venezuela) para la base configurada en .env
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'America/Caracas');
END
$$;

-- Ningún rol que no sea el propietario puede crear objetos en public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Esquema de auditoría para registrar cambios críticos
CREATE SCHEMA IF NOT EXISTS auditoria;

CREATE TABLE IF NOT EXISTS auditoria.eventos (
    id          BIGSERIAL PRIMARY KEY,
    tabla       TEXT        NOT NULL,
    operacion   TEXT        NOT NULL,
    registro    JSONB,
    usuario_db  TEXT        NOT NULL DEFAULT current_user,
    ip_origen   INET                 DEFAULT inet_client_addr(),
    fecha       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION auditoria.registrar() RETURNS trigger AS $$
BEGIN
    INSERT INTO auditoria.eventos (tabla, operacion, registro)
    VALUES (TG_TABLE_NAME, TG_OP,
            CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Los disparadores se enlazan cuando TypeORM crea las tablas
-- (ver backend/src/common/auditoria.bootstrap.ts).
