import { Router } from 'express';
import { todos } from '../db.js';
import { rota } from '../rota.js';

export const taRouter = Router();

/* ---------------------------------------------------------------------
 * TA = Tempo de Atendimento (minutos entre abrir o chamado e a manutencao
 * chegar na maquina). Estas rotas entregam o TA agregado por turno, por
 * dia e por tecnico, sempre respeitando os filtros de periodo/setor.
 * ------------------------------------------------------------------ */

type Filtros = {
  where: string;
  params: unknown[];
  meta: number;
};

/** Monta o WHERE comum a partir da querystring. */
function montarFiltros(q: Record<string, string | undefined>): Filtros {
  const where: string[] = ['o.atendido_em IS NOT NULL', `o.status <> 'Cancelada'`];
  const params: unknown[] = [];

  if (q.de) {
    where.push('date(o.aberto_em) >= date(?)');
    params.push(q.de);
  }
  if (q.ate) {
    where.push('date(o.aberto_em) <= date(?)');
    params.push(q.ate);
  }
  if (q.setor_id && q.setor_id !== 'todos') {
    where.push('m.setor_id = ?');
    params.push(q.setor_id);
  }
  if (q.maquina_id && q.maquina_id !== 'todos') {
    where.push('o.maquina_id = ?');
    params.push(q.maquina_id);
  }
  if (q.turno_id && q.turno_id !== 'todos') {
    where.push('o.turno_id = ?');
    params.push(q.turno_id);
  }
  if (q.tipo && q.tipo !== 'todos') {
    where.push('o.tipo = ?');
    params.push(q.tipo);
  }

  const meta = Math.max(Number(q.meta) || 15, 1);
  return { where: `WHERE ${where.join(' AND ')}`, params, meta };
}

const TA_MIN = `(julianday(o.atendido_em) - julianday(o.aberto_em)) * 1440`;
const REPARO_MIN = `(julianday(o.fim_em) - julianday(o.atendido_em)) * 1440`;

/* ---------------------------------------------------------------------
 * GET /api/ta/resumo - uma linha por turno
 * ------------------------------------------------------------------ */
taRouter.get(
  '/resumo',
  rota(async (req, res) => {
    const { where, params, meta } = montarFiltros(req.query as Record<string, string | undefined>);

    const linhas = await todos<any>(
      `SELECT
         COALESCE(t.id, 0)                AS turno_id,
         COALESCE(t.nome, 'Sem turno')    AS turno,
         COALESCE(t.hora_inicio, '--')    AS hora_inicio,
         COALESCE(t.hora_fim, '--')       AS hora_fim,
         COUNT(*)                                          AS chamados,
         ROUND(AVG(${TA_MIN}), 1)                          AS ta_medio,
         ROUND(MAX(${TA_MIN}), 1)                          AS ta_maximo,
         ROUND(MIN(${TA_MIN}), 1)                          AS ta_minimo,
         SUM(CASE WHEN ${TA_MIN} <= ? THEN 1 ELSE 0 END)   AS dentro_meta,
         ROUND(AVG(CASE WHEN o.fim_em IS NOT NULL THEN ${REPARO_MIN} END), 1) AS reparo_medio,
         SUM(CASE WHEN o.fim_em IS NULL THEN 1 ELSE 0 END) AS em_aberto
       FROM ocorrencias o
       LEFT JOIN maquinas m ON m.id = o.maquina_id
       LEFT JOIN turnos   t ON t.id = o.turno_id
       ${where}
       GROUP BY COALESCE(t.id, 0)
       ORDER BY COALESCE(t.hora_inicio, 'zz')`,
      [meta, ...params] as any,
    );

    const itens = linhas.map((l) => ({
      ...l,
      aderencia: l.chamados ? Math.round((l.dentro_meta / l.chamados) * 1000) / 10 : 0,
    }));

    const chamados = itens.reduce((s, l) => s + l.chamados, 0);
    const dentroMeta = itens.reduce((s, l) => s + l.dentro_meta, 0);
    const somaTa = itens.reduce((s, l) => s + (l.ta_medio || 0) * l.chamados, 0);

    res.json({
      meta,
      itens,
      total: {
        chamados,
        dentro_meta: dentroMeta,
        aderencia: chamados ? Math.round((dentroMeta / chamados) * 1000) / 10 : 0,
        ta_medio: chamados ? Math.round((somaTa / chamados) * 10) / 10 : 0,
      },
    });
  }),
);

/* ---------------------------------------------------------------------
 * GET /api/ta/serie - TA medio por dia, uma coluna por turno
 * ------------------------------------------------------------------ */
taRouter.get(
  '/serie',
  rota(async (req, res) => {
    const { where, params } = montarFiltros(req.query as Record<string, string | undefined>);

    const linhas = await todos<{
      dia: string;
      turno: string;
      ta_medio: number;
      chamados: number;
    }>(
      `SELECT
         date(o.aberto_em)             AS dia,
         COALESCE(t.nome, 'Sem turno') AS turno,
         ROUND(AVG(${TA_MIN}), 1)      AS ta_medio,
         COUNT(*)                      AS chamados
       FROM ocorrencias o
       LEFT JOIN maquinas m ON m.id = o.maquina_id
       LEFT JOIN turnos   t ON t.id = o.turno_id
       ${where}
       GROUP BY dia, turno
       ORDER BY dia`,
      params as any,
    );

    // Pivot: { dia, "1o Turno": 12.5, "2o Turno": 8.0, ... }
    const porDia = new Map<string, Record<string, unknown>>();
    const turnos = new Set<string>();

    for (const l of linhas) {
      turnos.add(l.turno);
      if (!porDia.has(l.dia)) porDia.set(l.dia, { dia: l.dia, chamados: 0 });
      const linha = porDia.get(l.dia)!;
      linha[l.turno] = l.ta_medio;
      linha.chamados = (linha.chamados as number) + l.chamados;
    }

    res.json({ turnos: [...turnos], itens: [...porDia.values()] });
  }),
);

/* ---------------------------------------------------------------------
 * GET /api/ta/tecnicos - desempenho por tecnico
 * ------------------------------------------------------------------ */
taRouter.get(
  '/tecnicos',
  rota(async (req, res) => {
    const { where, params, meta } = montarFiltros(req.query as Record<string, string | undefined>);

    const itens = await todos<any>(
      `SELECT
         COALESCE(tec.nome, 'Nao atribuido') AS tecnico,
         COUNT(*)                                        AS chamados,
         ROUND(AVG(${TA_MIN}), 1)                        AS ta_medio,
         ROUND(AVG(CASE WHEN o.fim_em IS NOT NULL THEN ${REPARO_MIN} END), 1) AS reparo_medio,
         SUM(CASE WHEN ${TA_MIN} <= ? THEN 1 ELSE 0 END) AS dentro_meta
       FROM ocorrencias o
       LEFT JOIN maquinas m   ON m.id   = o.maquina_id
       LEFT JOIN tecnicos tec ON tec.id = o.tecnico_id
       ${where}
       GROUP BY COALESCE(tec.id, 0)
       ORDER BY chamados DESC`,
      [meta, ...params] as any,
    );

    res.json({
      meta,
      itens: itens.map((l) => ({
        ...l,
        aderencia: l.chamados ? Math.round((l.dentro_meta / l.chamados) * 1000) / 10 : 0,
      })),
    });
  }),
);

/* ---------------------------------------------------------------------
 * GET /api/ta/piores - chamados que mais demoraram a ser atendidos
 * ------------------------------------------------------------------ */
taRouter.get(
  '/piores',
  rota(async (req, res) => {
    const { where, params } = montarFiltros(req.query as Record<string, string | undefined>);
    const limite = Math.min(Math.max(Number(req.query.limite) || 10, 1), 100);

    const itens = await todos(
      `SELECT
         o.id, o.aberto_em, o.atendido_em, o.descricao, o.prioridade,
         m.codigo AS maquina_codigo, m.nome AS maquina_nome,
         COALESCE(t.nome, 'Sem turno') AS turno,
         COALESCE(tec.nome, '-')       AS tecnico,
         ROUND(${TA_MIN}, 1)           AS ta_min
       FROM ocorrencias o
       LEFT JOIN maquinas m   ON m.id   = o.maquina_id
       LEFT JOIN turnos   t   ON t.id   = o.turno_id
       LEFT JOIN tecnicos tec ON tec.id = o.tecnico_id
       ${where}
       ORDER BY ta_min DESC
       LIMIT ?`,
      [...params, limite] as any,
    );

    res.json({ itens });
  }),
);
