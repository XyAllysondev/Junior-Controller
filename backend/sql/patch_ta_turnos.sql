-- =====================================================================
-- patch_ta_turnos.sql
-- Acrescenta o controle de TURNOS e a marcacao de inicio de atendimento,
-- que e o que permite calcular o TA (Tempo de Atendimento).
--
-- Este arquivo e idempotente: o executor de migracoes (src/db.ts) ignora
-- os "duplicate column name" quando o patch ja foi aplicado.
-- =====================================================================

CREATE TABLE IF NOT EXISTS turnos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT    NOT NULL UNIQUE,
  hora_inicio TEXT    NOT NULL,            -- 'HH:MM'
  hora_fim    TEXT    NOT NULL,            -- 'HH:MM' (pode virar o dia, ex 22:00 -> 06:00)
  ativo       INTEGER NOT NULL DEFAULT 1,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Turnos padrao 3x8. Nao duplica se ja existirem.
INSERT OR IGNORE INTO turnos (nome, hora_inicio, hora_fim) VALUES
  ('1o Turno', '06:00', '14:00'),
  ('2o Turno', '14:00', '22:00'),
  ('3o Turno', '22:00', '06:00');

-- Momento em que o tecnico efetivamente iniciou o atendimento.
ALTER TABLE ocorrencias ADD COLUMN atendido_em TEXT;

-- Turno em que a ocorrencia foi aberta.
ALTER TABLE ocorrencias ADD COLUMN turno_id INTEGER REFERENCES turnos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ocorrencias_turno ON ocorrencias(turno_id);
