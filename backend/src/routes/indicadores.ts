import { Router } from 'express';
import { diaISO, todos, um } from '../db.js';
import { rota } from '../rota.js';

export const indicadoresRouter = Router();

/* ---------------------------------------------------------------------
 * Indicadores classicos de manutencao.
 *
 *   MTTR  = tempo medio de reparo         -> media de (fim - atendimento)
 *   MTBF  = tempo medio entre falhas      -> horas operando / nro de falhas
 *   Disp. = disponibilidade                -> operando / programado
 *
 * "Horas programadas" = dias do periodo x horas_dia x maquinas ativas.
 * O parametro horas_dia (padrao 24) permite ajustar para fabricas que
 * nao rodam 3 turnos.
 * ------------------------------------------------------------------ */

const REPARO_MIN = `(julianday(o.fim_em) - julianday(o.atendido_em)) * 1440`;
const PARADA_MIN = `(julianday(o.fim_em) - julianday(o.aberto_em)) * 1440`;

type Ctx = {
  where: string;
  params: unknown[];
  de: string;
  ate: string;
  horasDia: number;
};

function montarCtx(q: Record<string, string | undefined>): Ctx {
  const de = q.de || diaISO(29);
  const ate = q.ate || diaISO(0);

  const where: string[] = [
    `o.status <> 'Cancelada'`,
    'date(o.aberto_em) >= date(?)',
    'date(o.aberto_em) <= date(?)',
  ];
  const params: unknown[] = [de, ate];

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

  return {
    where: `WHERE ${where.join(' AND ')}`,
    params,
    de,
    ate,
    horasDia: Math.min(Math.max(Number(q.horas_dia) || 24, 1), 24),
  };
}

/** Quantas maquinas ativas entram no calculo, respeitando os filtros. */
async function contarMaquinas(q: Record<string, string | undefined>): Promise<number> {
  const where = ['m.ativo = 1'];
  const params: unknown[] = [];
  if (q.setor_id && q.setor_id !== 'todos') {
    where.push('m.setor_id = ?');
    params.push(q.setor_id);
  }
  if (q.maquina_id && q.maquina_id !== 'todos') {
    where.push('m.id = ?');
    params.push(q.maquina_id);
  }
  const linha = await um<{ n: number }>(
    `SELECT COUNT(*) AS n FROM maquinas m WHERE ${where.join(' AND ')}`,
    params as any,
  );
  return linha?.n ?? 0;
}

/** Dias do periodo, inclusive as duas pontas. */
async function diasDoPeriodo(de: string, ate: string): Promise<number> {
  const linha = await um<{ d: number }>('SELECT julianday(?) - julianday(?) + 1 AS d', [ate, de]);
  return linha?.d || 1;
}

const arred = (v: number, casas = 1) => Math.round(v * 10 ** casas) / 10 ** casas;

/* ---------------------------------------------------------------------
 * GET /api/indicadores/resumo -> os cartoes do topo do dashboard
 * ------------------------------------------------------------------ */
indicadoresRouter.get(
  '/resumo',
  rota(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    const ctx = montarCtx(q);

    const agg = await um<Record<string, number | null>>(
      `SELECT
         COUNT(*)                                                       AS total,
         SUM(CASE WHEN o.status = 'Aberta'         THEN 1 ELSE 0 END)   AS abertas,
         SUM(CASE WHEN o.status = 'Em atendimento' THEN 1 ELSE 0 END)   AS em_atendimento,
         SUM(CASE WHEN o.status = 'Concluida'      THEN 1 ELSE 0 END)   AS concluidas,
         SUM(CASE WHEN o.tipo   = 'Corretiva'      THEN 1 ELSE 0 END)   AS corretivas,
         SUM(CASE WHEN o.tipo   = 'Preventiva'     THEN 1 ELSE 0 END)   AS preventivas,
         SUM(CASE WHEN o.prioridade = 'Critica' AND o.status <> 'Concluida' THEN 1 ELSE 0 END) AS criticas_abertas,
         AVG(CASE WHEN o.fim_em IS NOT NULL AND o.atendido_em IS NOT NULL THEN ${REPARO_MIN} END) AS mttr_min,
         AVG(CASE WHEN o.atendido_em IS NOT NULL THEN (julianday(o.atendido_em) - julianday(o.aberto_em)) * 1440 END) AS ta_min,
         SUM(CASE WHEN o.fim_em IS NOT NULL AND o.parou_producao = 1 THEN ${PARADA_MIN} ELSE 0 END) AS parada_total_min
       FROM ocorrencias o
       LEFT JOIN maquinas m ON m.id = o.maquina_id
       ${ctx.where}`,
      ctx.params as any,
    );

    const dias = await diasDoPeriodo(ctx.de, ctx.ate);
    const maquinas = await contarMaquinas(q);

    const horasProgramadas = dias * ctx.horasDia * Math.max(maquinas, 1);
    const horasParadas = (agg?.parada_total_min || 0) / 60;
    const horasOperando = Math.max(horasProgramadas - horasParadas, 0);
    const falhas = agg?.corretivas || 0;

    res.json({
      periodo: {
        de: ctx.de,
        ate: ctx.ate,
        dias: Math.round(dias),
        horas_dia: ctx.horasDia,
        maquinas,
      },
      total: agg?.total || 0,
      abertas: agg?.abertas || 0,
      em_atendimento: agg?.em_atendimento || 0,
      concluidas: agg?.concluidas || 0,
      corretivas: agg?.corretivas || 0,
      preventivas: agg?.preventivas || 0,
      criticas_abertas: agg?.criticas_abertas || 0,
      mttr_min: arred(agg?.mttr_min || 0),
      ta_min: arred(agg?.ta_min || 0),
      mtbf_h: falhas > 0 ? arred(horasOperando / falhas) : null,
      horas_paradas: arred(horasParadas),
      horas_programadas: arred(horasProgramadas),
      disponibilidade:
        horasProgramadas > 0 ? arred((horasOperando / horasProgramadas) * 100, 2) : null,
    });
  }),
);

/* ---------------------------------------------------------------------
 * GET /api/indicadores/por-maquina -> ranking de maquinas problematicas
 * ------------------------------------------------------------------ */
indicadoresRouter.get(
  '/por-maquina',
  rota(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    const ctx = montarCtx(q);
    const limite = Math.min(Math.max(Number(q.limite) || 10, 1), 100);

    const dias = await diasDoPeriodo(ctx.de, ctx.ate);
    const horasProgramadas = dias * ctx.horasDia;

    const linhas = await todos<any>(
      `SELECT
         m.id, m.codigo, m.nome, m.criticidade,
         COALESCE(s.nome, '-') AS setor,
         COUNT(*)                                     AS paradas,
         SUM(CASE WHEN o.tipo = 'Corretiva' THEN 1 ELSE 0 END) AS falhas,
         ROUND(SUM(CASE WHEN o.fim_em IS NOT NULL AND o.parou_producao = 1 THEN ${PARADA_MIN} ELSE 0 END), 1) AS minutos_parado,
         ROUND(AVG(CASE WHEN o.fim_em IS NOT NULL AND o.atendido_em IS NOT NULL THEN ${REPARO_MIN} END), 1)   AS mttr_min
       FROM ocorrencias o
       LEFT JOIN maquinas m ON m.id = o.maquina_id
       LEFT JOIN setores  s ON s.id = m.setor_id
       ${ctx.where}
       GROUP BY m.id
       ORDER BY minutos_parado DESC
       LIMIT ?`,
      [...ctx.params, limite] as any,
    );

    res.json({
      itens: linhas.map((l) => {
        const horasParado = (l.minutos_parado || 0) / 60;
        const operando = Math.max(horasProgramadas - horasParado, 0);
        return {
          ...l,
          horas_parado: arred(horasParado, 2),
          disponibilidade: arred((operando / horasProgramadas) * 100, 2),
          mtbf_h: l.falhas > 0 ? arred(operando / l.falhas) : null,
        };
      }),
    });
  }),
);

/* ---------------------------------------------------------------------
 * GET /api/indicadores/pareto -> motivos que mais custam tempo de parada
 * ------------------------------------------------------------------ */
indicadoresRouter.get(
  '/pareto',
  rota(async (req, res) => {
    const ctx = montarCtx(req.query as Record<string, string | undefined>);
    const limite = Math.min(Math.max(Number(req.query.limite) || 8, 1), 50);

    const linhas = await todos<{
      motivo: string;
      categoria: string;
      ocorrencias: number;
      minutos: number;
    }>(
      `SELECT
         COALESCE(mo.nome, 'Nao informado')      AS motivo,
         COALESCE(mo.categoria, 'Outros')        AS categoria,
         COUNT(*)                                AS ocorrencias,
         ROUND(SUM(CASE WHEN o.fim_em IS NOT NULL THEN ${PARADA_MIN} ELSE 0 END), 1) AS minutos
       FROM ocorrencias o
       LEFT JOIN maquinas m  ON m.id  = o.maquina_id
       LEFT JOIN motivos  mo ON mo.id = o.motivo_id
       ${ctx.where}
       GROUP BY COALESCE(mo.id, 0)
       ORDER BY minutos DESC
       LIMIT ?`,
      [...ctx.params, limite] as any,
    );

    const total = linhas.reduce((s, l) => s + (l.minutos || 0), 0);
    let acumulado = 0;

    res.json({
      total_minutos: arred(total),
      itens: linhas.map((l) => {
        acumulado += l.minutos || 0;
        return {
          ...l,
          percentual: total ? arred((l.minutos / total) * 100) : 0,
          acumulado: total ? arred((acumulado / total) * 100) : 0,
        };
      }),
    });
  }),
);

/* ---------------------------------------------------------------------
 * GET /api/indicadores/serie -> paradas e minutos parados por dia
 * ------------------------------------------------------------------ */
indicadoresRouter.get(
  '/serie',
  rota(async (req, res) => {
    const ctx = montarCtx(req.query as Record<string, string | undefined>);

    const itens = await todos(
      `SELECT
         date(o.aberto_em) AS dia,
         COUNT(*)          AS ocorrencias,
         ROUND(SUM(CASE WHEN o.fim_em IS NOT NULL AND o.parou_producao = 1 THEN ${PARADA_MIN} ELSE 0 END), 1) AS minutos_parado,
         ROUND(AVG(CASE WHEN o.fim_em IS NOT NULL AND o.atendido_em IS NOT NULL THEN ${REPARO_MIN} END), 1)   AS mttr_min
       FROM ocorrencias o
       LEFT JOIN maquinas m ON m.id = o.maquina_id
       ${ctx.where}
       GROUP BY dia
       ORDER BY dia`,
      ctx.params as any,
    );

    res.json({ itens });
  }),
);

/* ---------------------------------------------------------------------
 * GET /api/indicadores/distribuicao -> fatias por tipo, categoria e setor
 * ------------------------------------------------------------------ */
indicadoresRouter.get(
  '/distribuicao',
  rota(async (req, res) => {
    const ctx = montarCtx(req.query as Record<string, string | undefined>);

    const porGrupo = (expr: string) =>
      todos(
        `SELECT ${expr} AS rotulo, COUNT(*) AS total,
                ROUND(SUM(CASE WHEN o.fim_em IS NOT NULL THEN ${PARADA_MIN} ELSE 0 END), 1) AS minutos
         FROM ocorrencias o
         LEFT JOIN maquinas m  ON m.id  = o.maquina_id
         LEFT JOIN setores  s  ON s.id  = m.setor_id
         LEFT JOIN motivos  mo ON mo.id = o.motivo_id
         ${ctx.where}
         GROUP BY rotulo
         ORDER BY total DESC`,
        ctx.params as any,
      );

    const [por_tipo, por_categoria, por_setor, por_prioridade] = await Promise.all([
      porGrupo('o.tipo'),
      porGrupo(`COALESCE(mo.categoria, 'Outros')`),
      porGrupo(`COALESCE(s.nome, 'Sem setor')`),
      porGrupo('o.prioridade'),
    ]);

    res.json({ por_tipo, por_categoria, por_setor, por_prioridade });
  }),
);
