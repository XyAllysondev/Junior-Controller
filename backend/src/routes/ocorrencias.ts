import { Router } from 'express';
import { z } from 'zod';
import { agora, db, toSqlDateTime, turnoDoHorario } from '../db.js';

export const ocorrenciasRouter = Router();

/* ---------------------------------------------------------------------
 * SELECT base: junta os cadastros e ja calcula os tempos em minutos.
 *   ta_min     = tempo ate a manutencao chegar (Tempo de Atendimento)
 *   reparo_min = tempo de mao na massa (base do MTTR)
 *   parada_min = tempo total que a maquina ficou fora
 * ------------------------------------------------------------------ */
const SELECT_BASE = `
  SELECT
    o.*,
    m.codigo      AS maquina_codigo,
    m.nome        AS maquina_nome,
    m.criticidade AS maquina_criticidade,
    s.id          AS setor_id,
    s.nome        AS setor_nome,
    mo.nome       AS motivo_nome,
    mo.categoria  AS motivo_categoria,
    t.nome        AS tecnico_nome,
    tu.nome       AS turno_nome,
    CAST(ROUND((julianday(o.atendido_em) - julianday(o.aberto_em))   * 1440) AS INTEGER) AS ta_min,
    CAST(ROUND((julianday(o.fim_em)      - julianday(o.atendido_em)) * 1440) AS INTEGER) AS reparo_min,
    CAST(ROUND((julianday(o.fim_em)      - julianday(o.aberto_em))   * 1440) AS INTEGER) AS parada_min
  FROM ocorrencias o
  LEFT JOIN maquinas m  ON m.id  = o.maquina_id
  LEFT JOIN setores  s  ON s.id  = m.setor_id
  LEFT JOIN motivos  mo ON mo.id = o.motivo_id
  LEFT JOIN tecnicos t  ON t.id  = o.tecnico_id
  LEFT JOIN turnos   tu ON tu.id = o.turno_id
`;

const dataHora = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional()
  .transform((v) => toSqlDateTime(v ?? null));

const idOpcional = z.coerce.number().int().positive().nullable().optional();

const schemaOcorrencia = z.object({
  maquina_id: z.coerce.number().int().positive({ message: 'Selecione a maquina' }),
  motivo_id: idOpcional,
  tecnico_id: idOpcional,
  turno_id: idOpcional,
  tipo: z.enum(['Corretiva', 'Preventiva', 'Preditiva', 'Melhoria']).default('Corretiva'),
  prioridade: z.enum(['Baixa', 'Media', 'Alta', 'Critica']).default('Media'),
  status: z.enum(['Aberta', 'Em atendimento', 'Concluida', 'Cancelada']).optional(),
  descricao: z.string().trim().min(3, 'Descreva o que aconteceu'),
  solucao: z.string().trim().nullable().optional(),
  parou_producao: z.coerce.number().int().min(0).max(1).default(1),
  aberto_em: dataHora,
  atendido_em: dataHora,
  fim_em: dataHora,
});

/** Deriva o status a partir dos carimbos de tempo, se nao vier explicito. */
function statusDerivado(dados: {
  status?: string;
  atendido_em?: string | null;
  fim_em?: string | null;
}): string {
  if (dados.status) return dados.status;
  if (dados.fim_em) return 'Concluida';
  if (dados.atendido_em) return 'Em atendimento';
  return 'Aberta';
}

function buscarPorId(id: number | string | bigint) {
  return db.prepare(`${SELECT_BASE} WHERE o.id = ?`).get(id);
}

/* ---------------------------------------------------------------------
 * GET /api/ocorrencias
 * Filtros aceitos: status, maquina_id, setor_id, motivo_id, tecnico_id,
 * turno_id, tipo, prioridade, de, ate, busca, pagina, porPagina
 * ------------------------------------------------------------------ */
ocorrenciasRouter.get('/', (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const where: string[] = [];
  const params: unknown[] = [];

  const igual = (campo: string, valor?: string) => {
    if (valor && valor !== 'todos') {
      where.push(`${campo} = ?`);
      params.push(valor);
    }
  };

  igual('o.status', q.status);
  igual('o.maquina_id', q.maquina_id);
  igual('m.setor_id', q.setor_id);
  igual('o.motivo_id', q.motivo_id);
  igual('o.tecnico_id', q.tecnico_id);
  igual('o.turno_id', q.turno_id);
  igual('o.tipo', q.tipo);
  igual('o.prioridade', q.prioridade);

  if (q.de) {
    where.push('date(o.aberto_em) >= date(?)');
    params.push(q.de);
  }
  if (q.ate) {
    where.push('date(o.aberto_em) <= date(?)');
    params.push(q.ate);
  }
  if (q.busca && q.busca.trim()) {
    where.push('(o.descricao LIKE ? OR o.solucao LIKE ? OR m.nome LIKE ? OR m.codigo LIKE ?)');
    const like = `%${q.busca.trim()}%`;
    params.push(like, like, like, like);
  }
  if (q.abertas === '1') {
    where.push(`o.status IN ('Aberta','Em atendimento')`);
  }

  const filtro = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM ocorrencias o LEFT JOIN maquinas m ON m.id = o.maquina_id ${filtro}`,
      )
      .get(...params) as { n: number }
  ).n;

  const porPagina = Math.min(Math.max(Number(q.porPagina) || 50, 1), 500);
  const pagina = Math.max(Number(q.pagina) || 1, 1);

  const itens = db
    .prepare(
      `${SELECT_BASE} ${filtro}
       ORDER BY (o.status IN ('Aberta','Em atendimento')) DESC, o.aberto_em DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, porPagina, (pagina - 1) * porPagina);

  res.json({ itens, total, pagina, porPagina, paginas: Math.max(Math.ceil(total / porPagina), 1) });
});

/* GET /api/ocorrencias/:id */
ocorrenciasRouter.get('/:id', (req, res) => {
  const item = buscarPorId(req.params.id);
  if (!item) return res.status(404).json({ erro: 'Ocorrencia nao encontrada' });
  res.json(item);
});

/* POST /api/ocorrencias */
ocorrenciasRouter.post('/', (req, res) => {
  const parsed = schemaOcorrencia.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ erro: 'Dados invalidos', detalhes: parsed.error.flatten().fieldErrors });
  }
  const d = parsed.data;

  const maquina = db.prepare('SELECT id FROM maquinas WHERE id = ?').get(d.maquina_id);
  if (!maquina) return res.status(400).json({ erro: 'Maquina nao encontrada' });

  const aberto = d.aberto_em || agora();
  const erro = validarLinhaDoTempo(aberto, d.atendido_em ?? null, d.fim_em ?? null);
  if (erro) return res.status(400).json({ erro });

  const info = db
    .prepare(
      `INSERT INTO ocorrencias
        (maquina_id, motivo_id, tecnico_id, turno_id, tipo, prioridade, status,
         descricao, solucao, parou_producao, aberto_em, atendido_em, fim_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      d.maquina_id,
      d.motivo_id ?? null,
      d.tecnico_id ?? null,
      d.turno_id ?? turnoDoHorario(aberto),
      d.tipo,
      d.prioridade,
      statusDerivado(d),
      d.descricao,
      d.solucao ?? null,
      d.parou_producao,
      aberto,
      d.atendido_em ?? null,
      d.fim_em ?? null,
    );

  res.status(201).json(buscarPorId(info.lastInsertRowid));
});

/* PUT /api/ocorrencias/:id */
ocorrenciasRouter.put('/:id', (req, res) => {
  const atual = db.prepare('SELECT * FROM ocorrencias WHERE id = ?').get(req.params.id) as
    | Record<string, any>
    | undefined;
  if (!atual) return res.status(404).json({ erro: 'Ocorrencia nao encontrada' });

  const parsed = schemaOcorrencia.partial().safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ erro: 'Dados invalidos', detalhes: parsed.error.flatten().fieldErrors });
  }
  const d = parsed.data as Record<string, any>;

  const futuro = { ...atual, ...d };
  const erro = validarLinhaDoTempo(futuro.aberto_em, futuro.atendido_em, futuro.fim_em);
  if (erro) return res.status(400).json({ erro });

  if (d.aberto_em && d.turno_id === undefined) {
    d.turno_id = turnoDoHorario(d.aberto_em);
  }
  if (d.status === undefined && ('atendido_em' in d || 'fim_em' in d)) {
    d.status = statusDerivado(futuro);
  }

  const colunas = [
    'maquina_id',
    'motivo_id',
    'tecnico_id',
    'turno_id',
    'tipo',
    'prioridade',
    'status',
    'descricao',
    'solucao',
    'parou_producao',
    'aberto_em',
    'atendido_em',
    'fim_em',
  ].filter((c) => d[c] !== undefined);

  if (colunas.length) {
    db.prepare(
      `UPDATE ocorrencias SET ${colunas.map((c) => `${c} = ?`).join(', ')},
        atualizado_em = datetime('now','localtime') WHERE id = ?`,
    ).run(...colunas.map((c) => d[c] ?? null), req.params.id);
  }

  res.json(buscarPorId(req.params.id));
});

/* POST /api/ocorrencias/:id/atender - a manutencao chegou na maquina */
ocorrenciasRouter.post('/:id/atender', (req, res) => {
  const atual = db.prepare('SELECT * FROM ocorrencias WHERE id = ?').get(req.params.id) as
    | Record<string, any>
    | undefined;
  if (!atual) return res.status(404).json({ erro: 'Ocorrencia nao encontrada' });

  const quando = toSqlDateTime(req.body?.atendido_em) || agora();
  const tecnico_id = req.body?.tecnico_id ? Number(req.body.tecnico_id) : atual.tecnico_id;

  const erro = validarLinhaDoTempo(atual.aberto_em, quando, atual.fim_em);
  if (erro) return res.status(400).json({ erro });

  db.prepare(
    `UPDATE ocorrencias
       SET atendido_em = ?, tecnico_id = ?, status = 'Em atendimento',
           atualizado_em = datetime('now','localtime')
     WHERE id = ?`,
  ).run(quando, tecnico_id ?? null, req.params.id);

  res.json(buscarPorId(req.params.id));
});

/* POST /api/ocorrencias/:id/concluir - maquina liberada para producao */
ocorrenciasRouter.post('/:id/concluir', (req, res) => {
  const atual = db.prepare('SELECT * FROM ocorrencias WHERE id = ?').get(req.params.id) as
    | Record<string, any>
    | undefined;
  if (!atual) return res.status(404).json({ erro: 'Ocorrencia nao encontrada' });

  const fim = toSqlDateTime(req.body?.fim_em) || agora();
  // Se ninguem marcou o inicio do atendimento, assume que comecou junto com o fim
  // do chamado seria enganoso: usamos a abertura para nao inventar um TA falso.
  const atendido = atual.atendido_em || toSqlDateTime(req.body?.atendido_em) || atual.aberto_em;
  const tecnico_id = req.body?.tecnico_id ? Number(req.body.tecnico_id) : atual.tecnico_id;

  const erro = validarLinhaDoTempo(atual.aberto_em, atendido, fim);
  if (erro) return res.status(400).json({ erro });

  db.prepare(
    `UPDATE ocorrencias
       SET fim_em = ?, atendido_em = ?, tecnico_id = ?, solucao = COALESCE(?, solucao),
           status = 'Concluida', atualizado_em = datetime('now','localtime')
     WHERE id = ?`,
  ).run(fim, atendido, tecnico_id ?? null, req.body?.solucao?.trim() || null, req.params.id);

  res.json(buscarPorId(req.params.id));
});

/* POST /api/ocorrencias/:id/reabrir */
ocorrenciasRouter.post('/:id/reabrir', (req, res) => {
  const atual = db.prepare('SELECT id FROM ocorrencias WHERE id = ?').get(req.params.id);
  if (!atual) return res.status(404).json({ erro: 'Ocorrencia nao encontrada' });

  db.prepare(
    `UPDATE ocorrencias
       SET fim_em = NULL, status = CASE WHEN atendido_em IS NULL THEN 'Aberta' ELSE 'Em atendimento' END,
           atualizado_em = datetime('now','localtime')
     WHERE id = ?`,
  ).run(req.params.id);

  res.json(buscarPorId(req.params.id));
});

/* DELETE /api/ocorrencias/:id */
ocorrenciasRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM ocorrencias WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ erro: 'Ocorrencia nao encontrada' });
  res.json({ ok: true, mensagem: 'Ocorrencia excluida.' });
});

/** Garante abertura <= atendimento <= fim. Devolve a mensagem de erro ou null. */
function validarLinhaDoTempo(
  aberto: string | null,
  atendido: string | null,
  fim: string | null,
): string | null {
  if (atendido && aberto && atendido < aberto) {
    return 'O inicio do atendimento nao pode ser anterior a abertura do chamado.';
  }
  if (fim && atendido && fim < atendido) {
    return 'O fim do reparo nao pode ser anterior ao inicio do atendimento.';
  }
  if (fim && aberto && fim < aberto) {
    return 'O fim do reparo nao pode ser anterior a abertura do chamado.';
  }
  return null;
}
