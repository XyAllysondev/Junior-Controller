/* ---------------------------------------------------------------------
 * Regras e contas do domínio.
 *
 * Este arquivo não sabe de onde vêm os dados: recebe as listas prontas e
 * devolve os mesmos formatos que a API do backend devolvia. É o que
 * permite ter o mesmo comportamento guardando no navegador ou no
 * Supabase — muda o armazém, não a conta.
 * ------------------------------------------------------------------ */

import { ErroApi, type Ocorrencia } from './api';

export type Registro = Record<string, any>;

export type Banco = {
  setores: Registro[];
  maquinas: Registro[];
  motivos: Registro[];
  tecnicos: Registro[];
  turnos: Registro[];
  ocorrencias: Registro[];
};

export const TABELAS = ['setores', 'maquinas', 'motivos', 'tecnicos', 'turnos'] as const;
export type Tabela = (typeof TABELAS)[number];

export const bancoVazio = (): Banco => ({
  setores: [],
  maquinas: [],
  motivos: [],
  tecnicos: [],
  turnos: [],
  ocorrencias: [],
});

/* ------------------------------------------------------------------ */
/* Datas                                                               */
/* ------------------------------------------------------------------ */

const doisDig = (n: number) => String(n).padStart(2, '0');

/** Agora, no formato usado no banco: "2026-08-31 14:05:00" */
export function agora(): string {
  const d = new Date();
  return `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())} ${doisDig(
    d.getHours(),
  )}:${doisDig(d.getMinutes())}:00`;
}

/** Normaliza o valor do <input type="datetime-local"> para o formato do banco. */
export function paraBanco(valor?: string | null): string | null {
  if (!valor) return null;
  const v = String(valor).trim().replace('T', ' ');
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v} 00:00:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) return `${v}:00`;
  return v.slice(0, 19);
}

/** O Postgres devolve "2026-08-31T14:05:00"; padronizamos com espaço. */
export const normalizar = (valor?: string | null): string | null =>
  valor ? String(valor).replace('T', ' ').slice(0, 19) : null;

const ms = (valor?: string | null): number | null => {
  if (!valor) return null;
  const t = new Date(String(valor).replace(' ', 'T')).getTime();
  return Number.isNaN(t) ? null : t;
};

/** Diferença em minutos. Null se faltar alguma ponta. */
function minutosEntre(de?: string | null, ate?: string | null): number | null {
  const a = ms(de);
  const b = ms(ate);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 60_000);
}

const soData = (valor?: string | null) => (valor ? String(valor).slice(0, 10) : '');

export function diaISO(diasAtras = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`;
}

export const arred = (v: number, casas = 1) => Math.round(v * 10 ** casas) / 10 ** casas;

/* ------------------------------------------------------------------ */
/* Regras                                                              */
/* ------------------------------------------------------------------ */

/** Descobre o turno de um horário (trata turno que vira o dia). */
export function turnoDoHorario(banco: Banco, dataHora: string | null): number | null {
  if (!dataHora) return null;
  const hhmm = String(dataHora).slice(11, 16);
  for (const t of banco.turnos.filter((t) => t.ativo === 1)) {
    const viraODia = t.hora_fim <= t.hora_inicio;
    const dentro = viraODia
      ? hhmm >= t.hora_inicio || hhmm < t.hora_fim
      : hhmm >= t.hora_inicio && hhmm < t.hora_fim;
    if (dentro) return t.id;
  }
  return null;
}

export function validarLinhaDoTempo(
  bruto_aberto: string | null,
  bruto_atendido: string | null,
  bruto_fim: string | null,
): string | null {
  // Padroniza antes de comparar: "2026-08-29T08:00" e "2026-08-29 08:00"
  // representam o mesmo instante, mas como texto o espaço vem antes do
  // "T" — e a comparação daria o contrário do esperado.
  const aberto = normalizar(bruto_aberto);
  const atendido = normalizar(bruto_atendido);
  const fim = normalizar(bruto_fim);

  if (atendido && aberto && atendido < aberto) {
    return 'O início do atendimento não pode ser anterior à abertura do chamado.';
  }
  if (fim && atendido && fim < atendido) {
    return 'O fim do reparo não pode ser anterior ao início do atendimento.';
  }
  if (fim && aberto && fim < aberto) {
    return 'O fim do reparo não pode ser anterior à abertura do chamado.';
  }
  return null;
}

/** Junta os cadastros e calcula os tempos — o equivalente ao SELECT com JOIN. */
export function enriquecer(banco: Banco, o: Registro): Ocorrencia {
  const maquina = banco.maquinas.find((m) => m.id === o.maquina_id);
  const setor = maquina ? banco.setores.find((s) => s.id === maquina.setor_id) : undefined;
  const motivo = banco.motivos.find((m) => m.id === o.motivo_id);
  const tecnico = banco.tecnicos.find((t) => t.id === o.tecnico_id);
  const turno = banco.turnos.find((t) => t.id === o.turno_id);

  const aberto = normalizar(o.aberto_em);
  const atendido = normalizar(o.atendido_em);
  const fim = normalizar(o.fim_em);

  return {
    ...o,
    aberto_em: aberto,
    atendido_em: atendido,
    fim_em: fim,
    maquina_codigo: maquina?.codigo ?? null,
    maquina_nome: maquina?.nome ?? null,
    maquina_criticidade: maquina?.criticidade ?? null,
    setor_id: setor?.id ?? null,
    setor_nome: setor?.nome ?? null,
    motivo_nome: motivo?.nome ?? null,
    motivo_categoria: motivo?.categoria ?? null,
    tecnico_nome: tecnico?.nome ?? null,
    turno_nome: turno?.nome ?? null,
    ta_min: minutosEntre(aberto, atendido),
    reparo_min: minutosEntre(atendido, fim),
    parada_min: minutosEntre(aberto, fim),
  } as Ocorrencia;
}

/* ------------------------------------------------------------------ */
/* Cadastros: metadados                                                */
/* ------------------------------------------------------------------ */

export const ROTULOS: Record<Tabela, string> = {
  setores: 'Setor',
  maquinas: 'Máquina',
  motivos: 'Motivo',
  tecnicos: 'Técnico',
  turnos: 'Turno',
};

export const CAMPOS: Record<Tabela, string[]> = {
  setores: ['nome', 'ativo'],
  maquinas: ['codigo', 'nome', 'setor_id', 'criticidade', 'ativo'],
  motivos: ['nome', 'categoria', 'ativo'],
  tecnicos: ['nome', 'matricula', 'especialidade', 'ativo'],
  turnos: ['nome', 'hora_inicio', 'hora_fim', 'ativo'],
};

/** Campos que não podem repetir, como o UNIQUE do banco. */
export const UNICOS: Record<Tabela, string[]> = {
  setores: ['nome'],
  maquinas: ['codigo'],
  motivos: ['nome'],
  tecnicos: ['matricula'],
  turnos: ['nome'],
};

export function ordenar(tabela: Tabela, lista: Registro[]): Registro[] {
  const chave = tabela === 'maquinas' ? 'codigo' : tabela === 'turnos' ? 'hora_inicio' : 'nome';
  return [...lista].sort((a, b) =>
    String(a[chave] ?? '').localeCompare(String(b[chave] ?? ''), 'pt-BR'),
  );
}

export function checarDuplicado(banco: Banco, tabela: Tabela, dados: Registro, id?: number) {
  for (const campo of UNICOS[tabela]) {
    const valor = dados[campo];
    if (valor === undefined || valor === null || valor === '') continue;
    const existe = banco[tabela].some(
      (r) => r.id !== id && String(r[campo] ?? '').toLowerCase() === String(valor).toLowerCase(),
    );
    if (existe) {
      throw new ErroApi(
        `Já existe outro registro em ${ROTULOS[tabela].toLowerCase()}s com esse nome/código.`,
        409,
      );
    }
  }
}

export function contarUsos(banco: Banco, tabela: Tabela, id: number): number {
  if (tabela === 'setores') return banco.maquinas.filter((m) => m.setor_id === id).length;
  const campo = {
    maquinas: 'maquina_id',
    motivos: 'motivo_id',
    tecnicos: 'tecnico_id',
    turnos: 'turno_id',
  }[tabela as Exclude<Tabela, 'setores'>];
  return banco.ocorrencias.filter((o) => o[campo] === id).length;
}

/* ------------------------------------------------------------------ */
/* Filtros                                                             */
/* ------------------------------------------------------------------ */

export type Params = Record<string, unknown>;

export const texto = (p: Params, chave: string): string | undefined => {
  const v = p[chave];
  if (v === undefined || v === null || v === '' || v === 'todos') return undefined;
  return String(v);
};

export const numero = (p: Params, chave: string): number | undefined => {
  const v = texto(p, chave);
  return v === undefined ? undefined : Number(v);
};

/** Filtro por período/setor/máquina/turno, usado pelo painel e pelo TA. */
function filtrarPorPeriodo(banco: Banco, p: Params, padraoDias = 30) {
  const de = texto(p, 'de') ?? diaISO(padraoDias - 1);
  const ate = texto(p, 'ate') ?? diaISO(0);
  const setor = numero(p, 'setor_id');
  const maquina = numero(p, 'maquina_id');
  const turno = numero(p, 'turno_id');
  const tipo = texto(p, 'tipo');

  const itens = banco.ocorrencias.filter((o) => {
    if (o.status === 'Cancelada') return false;
    const dia = soData(o.aberto_em);
    if (dia < de || dia > ate) return false;
    if (maquina !== undefined && o.maquina_id !== maquina) return false;
    if (turno !== undefined && o.turno_id !== turno) return false;
    if (tipo !== undefined && o.tipo !== tipo) return false;
    if (setor !== undefined) {
      const m = banco.maquinas.find((m) => m.id === o.maquina_id);
      if (!m || m.setor_id !== setor) return false;
    }
    return true;
  });

  return { itens, de, ate };
}

function diasEntre(de: string, ate: string): number {
  const a = ms(`${de} 00:00:00`);
  const b = ms(`${ate} 00:00:00`);
  if (a === null || b === null) return 1;
  return Math.max(Math.round((b - a) / 86_400_000) + 1, 1);
}

function contarMaquinas(banco: Banco, p: Params): number {
  const setor = numero(p, 'setor_id');
  const maquina = numero(p, 'maquina_id');
  return banco.maquinas.filter((m) => {
    if (m.ativo !== 1) return false;
    if (maquina !== undefined && m.id !== maquina) return false;
    if (setor !== undefined && m.setor_id !== setor) return false;
    return true;
  }).length;
}

/* ------------------------------------------------------------------ */
/* Lista de ocorrências                                                */
/* ------------------------------------------------------------------ */

export function listarOcorrencias(banco: Banco, p: Params) {
  const status = texto(p, 'status');
  const prioridade = texto(p, 'prioridade');
  const tipo = texto(p, 'tipo');
  const maquina = numero(p, 'maquina_id');
  const setor = numero(p, 'setor_id');
  const motivo = numero(p, 'motivo_id');
  const tecnico = numero(p, 'tecnico_id');
  const turno = numero(p, 'turno_id');
  const de = texto(p, 'de');
  const ate = texto(p, 'ate');
  const busca = texto(p, 'busca')?.toLowerCase();
  const somenteAbertas = String(p.abertas ?? '') === '1';

  let itens = banco.ocorrencias.map((o) => enriquecer(banco, o));

  itens = itens.filter((o) => {
    if (status && o.status !== status) return false;
    if (prioridade && o.prioridade !== prioridade) return false;
    if (tipo && o.tipo !== tipo) return false;
    if (maquina !== undefined && o.maquina_id !== maquina) return false;
    if (setor !== undefined && o.setor_id !== setor) return false;
    if (motivo !== undefined && o.motivo_id !== motivo) return false;
    if (tecnico !== undefined && o.tecnico_id !== tecnico) return false;
    if (turno !== undefined && o.turno_id !== turno) return false;
    if (de && soData(o.aberto_em) < de) return false;
    if (ate && soData(o.aberto_em) > ate) return false;
    if (somenteAbertas && o.status !== 'Aberta' && o.status !== 'Em atendimento') return false;
    if (busca) {
      const alvo = [o.descricao, o.solucao, o.maquina_nome, o.maquina_codigo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });

  const emAberto = (o: Ocorrencia) =>
    o.status === 'Aberta' || o.status === 'Em atendimento' ? 1 : 0;
  itens.sort(
    (a, b) => emAberto(b) - emAberto(a) || String(b.aberto_em).localeCompare(String(a.aberto_em)),
  );

  const total = itens.length;
  const porPagina = Math.min(Math.max(Number(p.porPagina) || 50, 1), 500);
  const pagina = Math.max(Number(p.pagina) || 1, 1);
  const inicio = (pagina - 1) * porPagina;

  return {
    itens: itens.slice(inicio, inicio + porPagina),
    total,
    pagina,
    porPagina,
    paginas: Math.max(Math.ceil(total / porPagina), 1),
  };
}

/* ------------------------------------------------------------------ */
/* TA por turno                                                        */
/* ------------------------------------------------------------------ */

export function rotasTa(banco: Banco, rota: string | undefined, p: Params) {
  const meta = Math.max(Number(p.meta) || 15, 1);
  const { itens: base } = filtrarPorPeriodo(banco, p);
  // TA só existe quando o atendimento foi registrado
  const itens = base.filter((o) => o.atendido_em).map((o) => enriquecer(banco, o));

  if (rota === 'resumo') {
    const porTurno = new Map<number, Ocorrencia[]>();
    for (const o of itens) {
      const chave = o.turno_id ?? 0;
      if (!porTurno.has(chave)) porTurno.set(chave, []);
      porTurno.get(chave)!.push(o);
    }

    const linhas = [...porTurno.entries()]
      .map(([turnoId, lista]) => {
        const turno = banco.turnos.find((t) => t.id === turnoId);
        const tas = lista.map((o) => o.ta_min ?? 0);
        const reparos = lista.filter((o) => o.reparo_min !== null).map((o) => o.reparo_min!);
        const dentroMeta = tas.filter((t) => t <= meta).length;
        return {
          turno_id: turnoId,
          turno: turno?.nome ?? 'Sem turno',
          hora_inicio: turno?.hora_inicio ?? '--',
          hora_fim: turno?.hora_fim ?? '--',
          chamados: lista.length,
          ta_medio: tas.length ? arred(tas.reduce((s, v) => s + v, 0) / tas.length) : null,
          ta_maximo: tas.length ? Math.max(...tas) : null,
          ta_minimo: tas.length ? Math.min(...tas) : null,
          dentro_meta: dentroMeta,
          reparo_medio: reparos.length
            ? arred(reparos.reduce((s, v) => s + v, 0) / reparos.length)
            : null,
          em_aberto: lista.filter((o) => !o.fim_em).length,
          aderencia: lista.length ? arred((dentroMeta / lista.length) * 100) : 0,
        };
      })
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

    const chamados = linhas.reduce((s, l) => s + l.chamados, 0);
    const dentro = linhas.reduce((s, l) => s + l.dentro_meta, 0);
    const somaTa = linhas.reduce((s, l) => s + (l.ta_medio ?? 0) * l.chamados, 0);

    return {
      meta,
      itens: linhas,
      total: {
        chamados,
        dentro_meta: dentro,
        aderencia: chamados ? arred((dentro / chamados) * 100) : 0,
        ta_medio: chamados ? arred(somaTa / chamados) : 0,
      },
    };
  }

  if (rota === 'serie') {
    const porDia = new Map<string, Record<string, unknown>>();
    const turnos = new Set<string>();
    const acumulado = new Map<string, { soma: number; n: number }>();

    for (const o of itens) {
      const dia = soData(o.aberto_em);
      const turno = banco.turnos.find((t) => t.id === o.turno_id)?.nome ?? 'Sem turno';
      turnos.add(turno);
      const chave = `${dia}|${turno}`;
      const atual = acumulado.get(chave) ?? { soma: 0, n: 0 };
      acumulado.set(chave, { soma: atual.soma + (o.ta_min ?? 0), n: atual.n + 1 });
      if (!porDia.has(dia)) porDia.set(dia, { dia, chamados: 0 });
      const linha = porDia.get(dia)!;
      linha.chamados = (linha.chamados as number) + 1;
    }

    for (const [chave, { soma, n }] of acumulado) {
      const [dia, turno] = chave.split('|');
      porDia.get(dia)![turno] = arred(soma / n);
    }

    return {
      turnos: [...turnos],
      itens: [...porDia.values()].sort((a, b) => String(a.dia).localeCompare(String(b.dia))),
    };
  }

  if (rota === 'tecnicos') {
    const porTecnico = new Map<number, Ocorrencia[]>();
    for (const o of itens) {
      const chave = o.tecnico_id ?? 0;
      if (!porTecnico.has(chave)) porTecnico.set(chave, []);
      porTecnico.get(chave)!.push(o);
    }

    const linhas = [...porTecnico.entries()]
      .map(([tecnicoId, lista]) => {
        const tas = lista.map((o) => o.ta_min ?? 0);
        const reparos = lista.filter((o) => o.reparo_min !== null).map((o) => o.reparo_min!);
        const dentroMeta = tas.filter((t) => t <= meta).length;
        return {
          tecnico: banco.tecnicos.find((t) => t.id === tecnicoId)?.nome ?? 'Não atribuído',
          chamados: lista.length,
          ta_medio: tas.length ? arred(tas.reduce((s, v) => s + v, 0) / tas.length) : null,
          reparo_medio: reparos.length
            ? arred(reparos.reduce((s, v) => s + v, 0) / reparos.length)
            : null,
          dentro_meta: dentroMeta,
          aderencia: lista.length ? arred((dentroMeta / lista.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.chamados - a.chamados);

    return { meta, itens: linhas };
  }

  if (rota === 'piores') {
    const limite = Math.min(Math.max(Number(p.limite) || 10, 1), 100);
    return {
      itens: [...itens]
        .sort((a, b) => (b.ta_min ?? 0) - (a.ta_min ?? 0))
        .slice(0, limite)
        .map((o) => ({
          id: o.id,
          aberto_em: o.aberto_em,
          atendido_em: o.atendido_em,
          descricao: o.descricao,
          prioridade: o.prioridade,
          maquina_codigo: o.maquina_codigo,
          maquina_nome: o.maquina_nome,
          turno: o.turno_nome ?? 'Sem turno',
          tecnico: o.tecnico_nome ?? '-',
          ta_min: o.ta_min,
        })),
    };
  }

  throw new ErroApi(`Rota de TA não encontrada: ${rota}`, 404);
}

/* ------------------------------------------------------------------ */
/* Indicadores                                                         */
/* ------------------------------------------------------------------ */

export function rotasIndicadores(banco: Banco, rota: string | undefined, p: Params) {
  const { itens: brutos, de, ate } = filtrarPorPeriodo(banco, p);
  const itens = brutos.map((o) => enriquecer(banco, o));
  const horasDia = Math.min(Math.max(Number(p.horas_dia) || 24, 1), 24);
  const dias = diasEntre(de, ate);

  /** Minutos em que a máquina ficou realmente parada (só o que travou a produção). */
  const paradaReal = (o: Ocorrencia) =>
    o.fim_em && o.parou_producao === 1 ? (o.parada_min ?? 0) : 0;

  if (rota === 'resumo') {
    const maquinas = contarMaquinas(banco, p);
    const horasProgramadas = dias * horasDia * Math.max(maquinas, 1);
    const horasParadas = itens.reduce((s, o) => s + paradaReal(o), 0) / 60;
    const horasOperando = Math.max(horasProgramadas - horasParadas, 0);

    const reparos = itens.filter((o) => o.reparo_min !== null).map((o) => o.reparo_min!);
    const tas = itens.filter((o) => o.ta_min !== null).map((o) => o.ta_min!);
    const corretivas = itens.filter((o) => o.tipo === 'Corretiva').length;

    return {
      periodo: { de, ate, dias, horas_dia: horasDia, maquinas },
      total: itens.length,
      abertas: itens.filter((o) => o.status === 'Aberta').length,
      em_atendimento: itens.filter((o) => o.status === 'Em atendimento').length,
      concluidas: itens.filter((o) => o.status === 'Concluida').length,
      corretivas,
      preventivas: itens.filter((o) => o.tipo === 'Preventiva').length,
      criticas_abertas: itens.filter(
        (o) => o.prioridade === 'Critica' && o.status !== 'Concluida',
      ).length,
      mttr_min: reparos.length ? arred(reparos.reduce((s, v) => s + v, 0) / reparos.length) : 0,
      ta_min: tas.length ? arred(tas.reduce((s, v) => s + v, 0) / tas.length) : 0,
      mtbf_h: corretivas > 0 ? arred(horasOperando / corretivas) : null,
      horas_paradas: arred(horasParadas),
      horas_programadas: arred(horasProgramadas),
      disponibilidade:
        horasProgramadas > 0 ? arred((horasOperando / horasProgramadas) * 100, 2) : null,
    };
  }

  if (rota === 'por-maquina') {
    const limite = Math.min(Math.max(Number(p.limite) || 10, 1), 100);
    const horasProgramadas = dias * horasDia;
    const porMaquina = new Map<number, Ocorrencia[]>();

    for (const o of itens) {
      if (!porMaquina.has(o.maquina_id)) porMaquina.set(o.maquina_id, []);
      porMaquina.get(o.maquina_id)!.push(o);
    }

    return {
      itens: [...porMaquina.entries()]
        .map(([id, lista]) => {
          const maquina = banco.maquinas.find((m) => m.id === id);
          const setor = banco.setores.find((s) => s.id === maquina?.setor_id);
          const minutosParado = lista.reduce((s, o) => s + paradaReal(o), 0);
          const reparos = lista.filter((o) => o.reparo_min !== null).map((o) => o.reparo_min!);
          const falhas = lista.filter((o) => o.tipo === 'Corretiva').length;
          const horasParado = minutosParado / 60;
          const operando = Math.max(horasProgramadas - horasParado, 0);
          return {
            id,
            codigo: maquina?.codigo ?? '-',
            nome: maquina?.nome ?? '-',
            criticidade: maquina?.criticidade ?? 'Media',
            setor: setor?.nome ?? '-',
            paradas: lista.length,
            falhas,
            minutos_parado: arred(minutosParado),
            mttr_min: reparos.length
              ? arred(reparos.reduce((s, v) => s + v, 0) / reparos.length)
              : null,
            horas_parado: arred(horasParado, 2),
            disponibilidade: arred((operando / horasProgramadas) * 100, 2),
            mtbf_h: falhas > 0 ? arred(operando / falhas) : null,
          };
        })
        .sort((a, b) => b.minutos_parado - a.minutos_parado)
        .slice(0, limite),
    };
  }

  if (rota === 'pareto') {
    const limite = Math.min(Math.max(Number(p.limite) || 8, 1), 50);
    const porMotivo = new Map<number, Ocorrencia[]>();
    for (const o of itens) {
      const chave = o.motivo_id ?? 0;
      if (!porMotivo.has(chave)) porMotivo.set(chave, []);
      porMotivo.get(chave)!.push(o);
    }

    const linhas = [...porMotivo.entries()]
      .map(([id, lista]) => {
        const motivo = banco.motivos.find((m) => m.id === id);
        return {
          motivo: motivo?.nome ?? 'Não informado',
          categoria: motivo?.categoria ?? 'Outros',
          ocorrencias: lista.length,
          minutos: arred(lista.reduce((s, o) => s + (o.fim_em ? (o.parada_min ?? 0) : 0), 0)),
        };
      })
      .sort((a, b) => b.minutos - a.minutos)
      .slice(0, limite);

    const total = linhas.reduce((s, l) => s + l.minutos, 0);
    let acumulado = 0;

    return {
      total_minutos: arred(total),
      itens: linhas.map((l) => {
        acumulado += l.minutos;
        return {
          ...l,
          percentual: total ? arred((l.minutos / total) * 100) : 0,
          acumulado: total ? arred((acumulado / total) * 100) : 0,
        };
      }),
    };
  }

  if (rota === 'serie') {
    const porDia = new Map<string, Ocorrencia[]>();
    for (const o of itens) {
      const dia = soData(o.aberto_em);
      if (!porDia.has(dia)) porDia.set(dia, []);
      porDia.get(dia)!.push(o);
    }

    return {
      itens: [...porDia.entries()]
        .map(([dia, lista]) => {
          const reparos = lista.filter((o) => o.reparo_min !== null).map((o) => o.reparo_min!);
          return {
            dia,
            ocorrencias: lista.length,
            minutos_parado: arred(lista.reduce((s, o) => s + paradaReal(o), 0)),
            mttr_min: reparos.length
              ? arred(reparos.reduce((s, v) => s + v, 0) / reparos.length)
              : null,
          };
        })
        .sort((a, b) => a.dia.localeCompare(b.dia)),
    };
  }

  if (rota === 'distribuicao') {
    const agrupar = (rotulo: (o: Ocorrencia) => string) => {
      const mapa = new Map<string, Ocorrencia[]>();
      for (const o of itens) {
        const chave = rotulo(o);
        if (!mapa.has(chave)) mapa.set(chave, []);
        mapa.get(chave)!.push(o);
      }
      return [...mapa.entries()]
        .map(([rotulo, lista]) => ({
          rotulo,
          total: lista.length,
          minutos: arred(lista.reduce((s, o) => s + (o.fim_em ? (o.parada_min ?? 0) : 0), 0)),
        }))
        .sort((a, b) => b.total - a.total);
    };

    return {
      por_tipo: agrupar((o) => o.tipo),
      por_categoria: agrupar((o) => o.motivo_categoria ?? 'Outros'),
      por_setor: agrupar((o) => o.setor_nome ?? 'Sem setor'),
      por_prioridade: agrupar((o) => o.prioridade),
    };
  }

  throw new ErroApi(`Rota de indicadores não encontrada: ${rota}`, 404);
}
