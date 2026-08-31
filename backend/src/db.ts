import { createClient, type InArgs, type Row } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pasta deste arquivo.
 *
 * Rodando como ESM (local), vem de import.meta.url. Quando o empacotador
 * da nuvem gera CommonJS, import.meta vira um objeto vazio - por isso a
 * checagem antes de converter. Nesse caso caimos no diretorio de trabalho,
 * e a busca dos .sql mais abaixo cobre o resto.
 */
const PASTA_DESTE_ARQUIVO = (() => {
  const url = (import.meta as { url?: string } | undefined)?.url;
  if (typeof url === 'string' && url.length > 0) {
    try {
      return path.dirname(fileURLToPath(url));
    } catch {
      /* url em formato inesperado: usa o fallback */
    }
  }
  return process.cwd();
})();

/** Raiz da pasta backend/ (src/.. -> backend) */
export const ROOT = path.resolve(PASTA_DESTE_ARQUIVO, '..');

/* ---------------------------------------------------------------------
 * Fuso horario
 *
 * Na nuvem o servidor roda em UTC, entao "localtime" do SQLite daria um
 * horario 3h adiantado para o Brasil. Guardamos o deslocamento num lugar
 * so e usamos ele em toda consulta que precisa de "agora".
 * O Brasil nao usa mais horario de verao, entao -3 vale o ano inteiro.
 * ------------------------------------------------------------------ */
const FUSO_BRUTO = (process.env.FUSO_HORARIO ?? '-3').trim();
if (!/^[+-]?\d{1,2}(\.\d+)?$/.test(FUSO_BRUTO)) {
  throw new Error(`FUSO_HORARIO invalido: "${FUSO_BRUTO}". Use um numero de horas, ex.: -3`);
}
const FUSO_HORAS = Number(FUSO_BRUTO);
const FUSO_SQL = `${FUSO_HORAS >= 0 ? '+' : ''}${FUSO_HORAS} hours`;

/** Expressao SQL de "agora" no fuso da fabrica. */
export const AGORA_SQL = `datetime('now', '${FUSO_SQL}')`;
/** Expressao SQL de "hoje" no fuso da fabrica. */
export const HOJE_SQL = `date('now', '${FUSO_SQL}')`;

/** Data/hora atual no fuso da fabrica, no formato do banco. */
export function agora(): string {
  const d = new Date(Date.now() + FUSO_HORAS * 3_600_000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/** Data de hoje (ou N dias atras) no fuso da fabrica. */
export function diaISO(diasAtras = 0): string {
  const d = new Date(Date.now() + FUSO_HORAS * 3_600_000 - diasAtras * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------------
 * Conexao
 *
 * Em producao aponta para o Turso (SQLite hospedado). Sem as variaveis,
 * cai num arquivo local - e o mesmo cliente, entao o comportamento e
 * identico na sua maquina e na nuvem.
 * ------------------------------------------------------------------ */
const URL_TURSO = process.env.TURSO_DATABASE_URL?.trim();

function urlDoArquivoLocal(): string {
  const arquivo = path.resolve(ROOT, process.env.DB_FILE || 'data/manutencao.db');
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  // libsql espera URL: barras normais, inclusive no Windows.
  return `file:${arquivo.replace(/\\/g, '/')}`;
}

export const usandoTurso = Boolean(URL_TURSO);

export const db = createClient({
  url: URL_TURSO || urlDoArquivoLocal(),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

/* ---------------------------------------------------------------------
 * Helpers de consulta
 *
 * O libsql devolve linhas indexadas por posicao e por nome. Convertemos
 * para objetos simples usando a lista de colunas, o que evita surpresas
 * com chaves numericas no JSON.
 * ------------------------------------------------------------------ */
function paraObjeto<T>(linha: Row, colunas: string[]): T {
  const obj: Record<string, unknown> = {};
  colunas.forEach((nome, i) => {
    obj[nome] = linha[i];
  });
  return obj as T;
}

/** Executa e devolve todas as linhas. */
export async function todos<T = Record<string, any>>(sql: string, args: InArgs = []): Promise<T[]> {
  const r = await db.execute({ sql, args });
  return r.rows.map((linha) => paraObjeto<T>(linha, r.columns));
}

/** Executa e devolve a primeira linha (ou undefined). */
export async function um<T = Record<string, any>>(
  sql: string,
  args: InArgs = [],
): Promise<T | undefined> {
  const r = await db.execute({ sql, args });
  const linha = r.rows[0];
  return linha ? paraObjeto<T>(linha, r.columns) : undefined;
}

/** Executa INSERT/UPDATE/DELETE. */
export async function rodar(
  sql: string,
  args: InArgs = [],
): Promise<{ alteradas: number; id: number }> {
  const r = await db.execute({ sql, args });
  return { alteradas: Number(r.rowsAffected), id: Number(r.lastInsertRowid ?? 0) };
}

/* ---------------------------------------------------------------------
 * Migracoes
 * ------------------------------------------------------------------ */
const MIGRACOES = ['schema.sql', 'patch_ta_turnos.sql'];

/** Erros que significam "esse pedaco do patch ja existe" e podem ser ignorados. */
const JA_APLICADO = ['duplicate column name', 'already exists'];

function separarComandos(sql: string): string[] {
  return sql
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Troca o marcador {{AGORA}} dos arquivos .sql pela expressao com fuso. */
function aplicarFuso(sql: string): string {
  return sql.replaceAll('{{AGORA}}', AGORA_SQL);
}

/**
 * Onde os .sql podem estar.
 *
 * Rodando local, ficam ao lado do codigo. Ja numa funcao serverless o
 * codigo e empacotado num arquivo unico e os .sql sao copiados a parte
 * (includeFiles na Vercel, included_files na Netlify) - e cada plataforma
 * escolhe um layout diferente. Em vez de apostar num, procuramos em todos.
 */
function candidatosSql(arquivo: string): string[] {
  const bases = [
    ROOT, // backend/ (execucao local)
    process.cwd(), // raiz da tarefa na nuvem
    path.join(process.cwd(), 'backend'),
    PASTA_DESTE_ARQUIVO, // pasta do bundle
    path.join(PASTA_DESTE_ARQUIVO, '..'),
    path.join(PASTA_DESTE_ARQUIVO, '..', '..'),
    path.join(PASTA_DESTE_ARQUIVO, '..', '..', 'backend'),
  ];

  const caminhos = bases.flatMap((base) => [
    path.join(base, 'sql', arquivo),
    path.join(base, 'backend', 'sql', arquivo),
  ]);

  return [...new Set(caminhos)];
}

function acharSql(arquivo: string): string | null {
  return candidatosSql(arquivo).find((c) => fs.existsSync(c)) ?? null;
}

let migracaoEmAndamento: Promise<void> | null = null;

export function migrar(): Promise<void> {
  // Em serverless varias requisicoes podem chegar juntas na primeira
  // subida; uma promessa compartilhada evita rodar a migracao em paralelo.
  migracaoEmAndamento ??= (async () => {
    await db.execute(`CREATE TABLE IF NOT EXISTS _migrations (
      arquivo     TEXT PRIMARY KEY,
      aplicado_em TEXT NOT NULL
    )`);

    for (const arquivo of MIGRACOES) {
      const jaRodou = await um('SELECT 1 AS ok FROM _migrations WHERE arquivo = ?', [arquivo]);
      if (jaRodou) continue;

      const caminho = acharSql(arquivo);
      if (!caminho) {
        throw new Error(
          `Migracao "${arquivo}" nao encontrada. Procurei em:\n` +
            candidatosSql(arquivo)
              .map((c) => `  - ${c}`)
              .join('\n'),
        );
      }

      for (const comando of separarComandos(aplicarFuso(fs.readFileSync(caminho, 'utf8')))) {
        try {
          await db.execute(comando);
        } catch (err) {
          const msg = String((err as Error).message).toLowerCase();
          if (JA_APLICADO.some((p) => msg.includes(p))) continue;
          throw new Error(
            `Falha em ${arquivo}: ${(err as Error).message}\n--> ${comando.slice(0, 160)}`,
          );
        }
      }

      await rodar('INSERT INTO _migrations (arquivo, aplicado_em) VALUES (?, ?)', [
        arquivo,
        agora(),
      ]);
      console.log(`[db] migracao aplicada: ${arquivo}`);
    }
  })();

  return migracaoEmAndamento;
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
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:00`;
}

/** Descobre o turno que contem um horario 'HH:MM' (trata turno que vira o dia). */
export async function turnoDoHorario(dataHora: string | null): Promise<number | null> {
  if (!dataHora) return null;
  const hhmm = dataHora.slice(11, 16);
  if (!hhmm) return null;

  const turnos = await todos<{ id: number; hora_inicio: string; hora_fim: string }>(
    'SELECT id, hora_inicio, hora_fim FROM turnos WHERE ativo = 1',
  );

  for (const t of turnos) {
    const viraODia = t.hora_fim <= t.hora_inicio;
    const dentro = viraODia
      ? hhmm >= t.hora_inicio || hhmm < t.hora_fim
      : hhmm >= t.hora_inicio && hhmm < t.hora_fim;
    if (dentro) return t.id;
  }
  return null;
}
