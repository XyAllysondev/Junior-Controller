/* ---------------------------------------------------------------------
 * Cliente da API. Em desenvolvimento o Vite faz proxy de /api para o
 * backend (veja vite.config.ts), entao nao ha configuracao a fazer.
 * ------------------------------------------------------------------ */

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export class ErroApi extends Error {
  status: number;
  detalhes?: Record<string, string[]>;

  constructor(mensagem: string, status: number, detalhes?: Record<string, string[]>) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.detalhes = detalhes;
  }
}

async function requisicao<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ErroApi(
      'Nao foi possivel falar com o servidor. Confira se o backend esta rodando na porta 3333.',
      0,
    );
  }

  const texto = await resposta.text();
  const corpo = texto ? JSON.parse(texto) : null;

  if (!resposta.ok) {
    throw new ErroApi(
      corpo?.erro || `Falha na requisicao (${resposta.status})`,
      resposta.status,
      corpo?.detalhes,
    );
  }
  return corpo as T;
}

function query(params: Record<string, unknown> = {}): string {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '' || valor === 'todos') continue;
    busca.set(chave, String(valor));
  }
  const s = busca.toString();
  return s ? `?${s}` : '';
}

/* ---------------------------------------------------------------------
 * Onde os dados moram
 *
 *   supabase  -> banco na nuvem, compartilhado entre todos os aparelhos.
 *                Liga sozinho quando VITE_SUPABASE_URL e VITE_SUPABASE_KEY
 *                estao definidas. É o modo de produção.
 *   navegador -> localStorage deste aparelho. Não precisa de nada, mas
 *                cada pessoa tem a sua própria cópia.
 *   servidor  -> fala com a API em /api (backend Express). Só com
 *                VITE_MODO=servidor.
 *
 * Nos três casos as telas chamam as mesmas rotas.
 * ------------------------------------------------------------------ */
const TEM_SUPABASE = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_KEY,
);

export const MODO_SERVIDOR = (import.meta.env.VITE_MODO as string) === 'servidor';
export const MODO_SUPABASE = !MODO_SERVIDOR && TEM_SUPABASE;
/** Dados só neste aparelho: é quando o backup por arquivo faz sentido. */
export const MODO_NAVEGADOR = !MODO_SERVIDOR && !TEM_SUPABASE;

export const NOME_DO_MODO = MODO_SERVIDOR
  ? 'conectado ao servidor'
  : MODO_SUPABASE
    ? 'dados sincronizados na nuvem'
    : 'dados salvos neste navegador';

/* Imports dinâmicos de propósito: evitam ciclo com este arquivo e mantêm
   fora do pacote inicial o armazém que não for usado. */
let armazemPromise: Promise<import('./armazem').Armazem> | null = null;

function obterArmazem() {
  armazemPromise ??= MODO_SUPABASE
    ? import('./armazemSupabase').then((m) => m.armazemSupabase)
    : import('./armazem').then((m) => m.armazemNavegador);
  return armazemPromise;
}

async function semServidor<T>(
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  caminho: string,
  params: Record<string, unknown> = {},
  corpo: Record<string, unknown> = {},
): Promise<T> {
  const [{ rotear }, armazem] = await Promise.all([import('./roteador'), obterArmazem()]);
  return (await rotear(armazem, metodo, caminho, params, corpo)) as T;
}

export const api = {
  get: <T>(caminho: string, params?: Record<string, unknown>) =>
    MODO_SERVIDOR
      ? requisicao<T>(`${caminho}${query(params)}`)
      : semServidor<T>('GET', caminho, params ?? {}),

  post: <T>(caminho: string, corpo?: unknown) =>
    MODO_SERVIDOR
      ? requisicao<T>(caminho, { method: 'POST', body: JSON.stringify(corpo ?? {}) })
      : semServidor<T>('POST', caminho, {}, (corpo ?? {}) as Record<string, unknown>),

  put: <T>(caminho: string, corpo: unknown) =>
    MODO_SERVIDOR
      ? requisicao<T>(caminho, { method: 'PUT', body: JSON.stringify(corpo) })
      : semServidor<T>('PUT', caminho, {}, (corpo ?? {}) as Record<string, unknown>),

  del: <T>(caminho: string) =>
    MODO_SERVIDOR
      ? requisicao<T>(caminho, { method: 'DELETE' })
      : semServidor<T>('DELETE', caminho),
};

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type Criticidade = 'Baixa' | 'Media' | 'Alta';
export type Prioridade = 'Baixa' | 'Media' | 'Alta' | 'Critica';
export type StatusOcorrencia = 'Aberta' | 'Em atendimento' | 'Concluida' | 'Cancelada';
export type TipoManutencao = 'Corretiva' | 'Preventiva' | 'Preditiva' | 'Melhoria';

export type Setor = { id: number; nome: string; ativo: number; criado_em: string };

export type Maquina = {
  id: number;
  codigo: string;
  nome: string;
  setor_id: number | null;
  criticidade: Criticidade;
  ativo: number;
  criado_em: string;
};

export type Motivo = {
  id: number;
  nome: string;
  categoria: string;
  ativo: number;
  criado_em: string;
};

export type Tecnico = {
  id: number;
  nome: string;
  matricula: string | null;
  especialidade: string | null;
  ativo: number;
  criado_em: string;
};

export type Turno = {
  id: number;
  nome: string;
  hora_inicio: string;
  hora_fim: string;
  ativo: number;
  criado_em: string;
};

export type Lookups = {
  setores: Setor[];
  maquinas: Maquina[];
  motivos: Motivo[];
  tecnicos: Tecnico[];
  turnos: Turno[];
};

export type Ocorrencia = {
  id: number;
  maquina_id: number;
  motivo_id: number | null;
  tecnico_id: number | null;
  turno_id: number | null;
  tipo: TipoManutencao;
  prioridade: Prioridade;
  status: StatusOcorrencia;
  descricao: string;
  solucao: string | null;
  parou_producao: number;
  aberto_em: string;
  atendido_em: string | null;
  fim_em: string | null;
  criado_em: string;
  atualizado_em: string;
  // vindos do join
  maquina_codigo: string | null;
  maquina_nome: string | null;
  maquina_criticidade: Criticidade | null;
  setor_id: number | null;
  setor_nome: string | null;
  motivo_nome: string | null;
  motivo_categoria: string | null;
  tecnico_nome: string | null;
  turno_nome: string | null;
  // calculados
  ta_min: number | null;
  reparo_min: number | null;
  parada_min: number | null;
};

export type ListaOcorrencias = {
  itens: Ocorrencia[];
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
};

export type ResumoIndicadores = {
  periodo: { de: string; ate: string; dias: number; horas_dia: number; maquinas: number };
  total: number;
  abertas: number;
  em_atendimento: number;
  concluidas: number;
  corretivas: number;
  preventivas: number;
  criticas_abertas: number;
  mttr_min: number;
  ta_min: number;
  mtbf_h: number | null;
  horas_paradas: number;
  horas_programadas: number;
  disponibilidade: number | null;
};

export type LinhaMaquina = {
  id: number;
  codigo: string;
  nome: string;
  criticidade: Criticidade;
  setor: string;
  paradas: number;
  falhas: number;
  minutos_parado: number;
  mttr_min: number | null;
  horas_parado: number;
  disponibilidade: number;
  mtbf_h: number | null;
};

export type LinhaPareto = {
  motivo: string;
  categoria: string;
  ocorrencias: number;
  minutos: number;
  percentual: number;
  acumulado: number;
};

export type PontoSerie = {
  dia: string;
  ocorrencias: number;
  minutos_parado: number;
  mttr_min: number | null;
};

export type Fatia = { rotulo: string; total: number; minutos: number };

export type Distribuicao = {
  por_tipo: Fatia[];
  por_categoria: Fatia[];
  por_setor: Fatia[];
  por_prioridade: Fatia[];
};

export type LinhaTaTurno = {
  turno_id: number;
  turno: string;
  hora_inicio: string;
  hora_fim: string;
  chamados: number;
  ta_medio: number | null;
  ta_maximo: number | null;
  ta_minimo: number | null;
  dentro_meta: number;
  reparo_medio: number | null;
  em_aberto: number;
  aderencia: number;
};

export type ResumoTa = {
  meta: number;
  itens: LinhaTaTurno[];
  total: { chamados: number; dentro_meta: number; aderencia: number; ta_medio: number };
};

export type SerieTa = {
  turnos: string[];
  itens: (Record<string, number> & { dia: string; chamados: number })[];
};

export type LinhaTaTecnico = {
  tecnico: string;
  chamados: number;
  ta_medio: number | null;
  reparo_medio: number | null;
  dentro_meta: number;
  aderencia: number;
};

export type PiorTa = {
  id: number;
  aberto_em: string;
  atendido_em: string;
  descricao: string;
  prioridade: Prioridade;
  maquina_codigo: string;
  maquina_nome: string;
  turno: string;
  tecnico: string;
  ta_min: number;
};
