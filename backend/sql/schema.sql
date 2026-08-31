-- =====================================================================
-- schema.sql - estrutura base do controle de manutencao
-- Datas sao gravadas como texto no formato 'YYYY-MM-DD HH:MM:SS'
-- (horario local da fabrica), compativel com julianday()/strftime().
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Cadastros basicos (lookups)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS setores (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT    NOT NULL UNIQUE,
  ativo     INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS maquinas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo      TEXT    NOT NULL UNIQUE,
  nome        TEXT    NOT NULL,
  setor_id    INTEGER REFERENCES setores(id) ON DELETE SET NULL,
  criticidade TEXT    NOT NULL DEFAULT 'Media'
              CHECK (criticidade IN ('Baixa','Media','Alta')),
  ativo       INTEGER NOT NULL DEFAULT 1,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS motivos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT    NOT NULL UNIQUE,
  categoria TEXT    NOT NULL DEFAULT 'Mecanica'
            CHECK (categoria IN ('Mecanica','Eletrica','Hidraulica','Pneumatica',
                                 'Automacao','Operacional','Qualidade','Setup','Outros')),
  ativo     INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tecnicos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT    NOT NULL,
  matricula     TEXT    UNIQUE,
  especialidade TEXT,
  ativo         INTEGER NOT NULL DEFAULT 1,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------------------------------------------------------------------
-- Ocorrencias (paradas / chamados de manutencao)
--
-- Linha do tempo de um chamado:
--   aberto_em  -> maquina parou / chamado registrado
--   atendido_em-> manutencao chegou na maquina   (coluna criada no patch)
--   fim_em     -> maquina liberada para producao
--
--   TA   (Tempo de Atendimento) = atendido_em - aberto_em
--   MTTR (Tempo de Reparo)      = fim_em      - atendido_em
--   Parada total                = fim_em      - aberto_em
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ocorrencias (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  maquina_id     INTEGER NOT NULL REFERENCES maquinas(id) ON DELETE RESTRICT,
  motivo_id      INTEGER REFERENCES motivos(id)  ON DELETE SET NULL,
  tecnico_id     INTEGER REFERENCES tecnicos(id) ON DELETE SET NULL,

  tipo           TEXT NOT NULL DEFAULT 'Corretiva'
                 CHECK (tipo IN ('Corretiva','Preventiva','Preditiva','Melhoria')),
  prioridade     TEXT NOT NULL DEFAULT 'Media'
                 CHECK (prioridade IN ('Baixa','Media','Alta','Critica')),
  status         TEXT NOT NULL DEFAULT 'Aberta'
                 CHECK (status IN ('Aberta','Em atendimento','Concluida','Cancelada')),

  descricao      TEXT NOT NULL,
  solucao        TEXT,
  parou_producao INTEGER NOT NULL DEFAULT 1,

  aberto_em      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  fim_em         TEXT,

  criado_em      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  atualizado_em  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_maquina  ON ocorrencias(maquina_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_status   ON ocorrencias(status);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_abertura ON ocorrencias(aberto_em);
CREATE INDEX IF NOT EXISTS idx_maquinas_setor       ON maquinas(setor_id);
