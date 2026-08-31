import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Raiz da pasta backend/ (src/.. -> backend) */
export const ROOT = path.resolve(__dirname, '..');

const DB_FILE = path.resolve(ROOT, process.env.DB_FILE || 'data/manutencao.db');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ---------------------------------------------------------------------
 * Migracoes
 * Os arquivos sao aplicados na ordem da lista abaixo e registrados na
 * tabela _migrations, para nao rodarem duas vezes.
 * ------------------------------------------------------------------ */
const MIGRATIONS = ['schema.sql', 'patch_ta_turnos.sql'];

/** Erros que significam "esse pedaco do patch ja existe" e podem ser ignorados. */
const JA_APLICADO = [
  'duplicate column name',
  'already exists',
];

function splitStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function migrate(): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    arquivo    TEXT PRIMARY KEY,
    aplicado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);

  const jaRodou = db.prepare('SELECT 1 FROM _migrations WHERE arquivo = ?');
  const marcar = db.prepare('INSERT INTO _migrations (arquivo) VALUES (?)');

  for (const arquivo of MIGRATIONS) {
    if (jaRodou.get(arquivo)) continue;

    const caminho = path.join(ROOT, 'sql', arquivo);
    if (!fs.existsSync(caminho)) {
      console.warn(`[db] migracao nao encontrada, pulando: ${arquivo}`);
      continue;
    }

    for (const stmt of splitStatements(fs.readFileSync(caminho, 'utf8'))) {
      try {
        db.exec(stmt);
      } catch (err) {
        const msg = String((err as Error).message).toLowerCase();
        if (JA_APLICADO.some((p) => msg.includes(p))) continue;
        throw new Error(`Falha em ${arquivo}: ${(err as Error).message}\n--> ${stmt.slice(0, 160)}`);
      }
    }

    marcar.run(arquivo);
    console.log(`[db] migracao aplicada: ${arquivo}`);
  }
}

/* ---------------------------------------------------------------------
 * Helpers de data
 * ------------------------------------------------------------------ */

/**
 * Normaliza o que vem do input <input type="datetime-local"> ("2025-03-04T14:30")
 * para o formato do banco ("2025-03-04 14:30:00").
 */
export function toSqlDateTime(valor?: string | null): string | null {
  if (!valor) return null;
  const v = String(valor).trim().replace('T', ' ');
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v} 00:00:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) return `${v}:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(v)) return v.slice(0, 19);
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return toSqlDateTime(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` +
      ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  );
}

/** Data/hora atual no formato do banco (horario local). */
export function agora(): string {
  const linha = db.prepare(`SELECT datetime('now','localtime') AS d`).get() as { d: string };
  return linha.d;
}

/** Descobre o turno que contem um horario 'HH:MM' (trata turno que vira o dia). */
export function turnoDoHorario(dataHora: string | null): number | null {
  if (!dataHora) return null;
  const hhmm = dataHora.slice(11, 16);
  if (!hhmm) return null;
  const turnos = db
    .prepare('SELECT id, hora_inicio, hora_fim FROM turnos WHERE ativo = 1')
    .all() as { id: number; hora_inicio: string; hora_fim: string }[];

  for (const t of turnos) {
    const viraODia = t.hora_fim <= t.hora_inicio;
    const dentro = viraODia
      ? hhmm >= t.hora_inicio || hhmm < t.hora_fim
      : hhmm >= t.hora_inicio && hhmm < t.hora_fim;
    if (dentro) return t.id;
  }
  return null;
}
