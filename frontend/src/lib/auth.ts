/* ---------------------------------------------------------------------
 * Login do administrador (Supabase Auth).
 *
 * Existe uma conta só, criada à mão no painel do Supabase. Quem entra
 * com ela passa a mandar um token nas requisições, e é esse token que o
 * banco usa para liberar cadastros e exclusões — a trava é do Postgres,
 * não da tela. Esconder botões é conveniência; a regra de verdade está
 * nas políticas do supabase/schema.sql.
 * ------------------------------------------------------------------ */

const URL_BASE = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
const CHAVE = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

const GUARDADO = 'manutencao-sessao-v1';
/** Renova um pouco antes de vencer, para nunca mandar token expirado. */
const FOLGA_MS = 60_000;

export type Sessao = {
  token: string;
  refresh: string;
  expira_em: number; // epoch em ms
  email: string;
};

type Ouvinte = (sessao: Sessao | null) => void;
const ouvintes = new Set<Ouvinte>();

let sessaoAtual: Sessao | null = carregar();

function carregar(): Sessao | null {
  try {
    const bruto = localStorage.getItem(GUARDADO);
    return bruto ? (JSON.parse(bruto) as Sessao) : null;
  } catch {
    return null;
  }
}

function guardar(sessao: Sessao | null) {
  sessaoAtual = sessao;
  try {
    if (sessao) localStorage.setItem(GUARDADO, JSON.stringify(sessao));
    else localStorage.removeItem(GUARDADO);
  } catch {
    /* sem storage: a sessão vale só enquanto a aba estiver aberta */
  }
  for (const ouvinte of ouvintes) ouvinte(sessao);
}

/** Avisa a interface quando alguém entra ou sai. */
export function aoMudarSessao(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export const sessao = () => sessaoAtual;
export const estaLogado = () => sessaoAtual !== null;

/* ------------------------------------------------------------------ */
/* Chamadas ao Supabase Auth                                           */
/* ------------------------------------------------------------------ */

async function pedirToken(corpo: Record<string, string>, tipo: 'password' | 'refresh_token') {
  const resposta = await fetch(`${URL_BASE}/auth/v1/token?grant_type=${tipo}`, {
    method: 'POST',
    headers: { apikey: CHAVE!, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const msg = String(dados?.error_description ?? dados?.msg ?? dados?.message ?? '');
    if (/invalid login credentials/i.test(msg)) {
      throw new Error('E-mail ou senha incorretos.');
    }
    if (/email not confirmed/i.test(msg)) {
      throw new Error(
        'Este e-mail ainda não foi confirmado. No painel do Supabase, marque o usuário como confirmado.',
      );
    }
    throw new Error(msg || 'Não foi possível entrar.');
  }

  return {
    token: dados.access_token as string,
    refresh: dados.refresh_token as string,
    expira_em: Date.now() + Number(dados.expires_in ?? 3600) * 1000,
    email: String(dados.user?.email ?? ''),
  } satisfies Sessao;
}

export async function entrar(email: string, senha: string): Promise<Sessao> {
  if (!URL_BASE || !CHAVE) {
    throw new Error('Supabase não configurado: o login só funciona no modo nuvem.');
  }
  const nova = await pedirToken({ email: email.trim(), password: senha }, 'password');
  guardar(nova);
  return nova;
}

export async function sair(): Promise<void> {
  const atual = sessaoAtual;
  guardar(null);
  if (!atual || !URL_BASE || !CHAVE) return;
  // Melhor esforço: mesmo que o servidor não responda, a sessão local já saiu.
  try {
    await fetch(`${URL_BASE}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: CHAVE, Authorization: `Bearer ${atual.token}` },
    });
  } catch {
    /* ignora */
  }
}

/* Uma renovação por vez: várias requisições podem descobrir juntas que o
   token venceu, e não faz sentido pedir vários tokens novos. */
let renovacao: Promise<Sessao | null> | null = null;

async function renovar(): Promise<Sessao | null> {
  const atual = sessaoAtual;
  if (!atual) return null;

  renovacao ??= (async () => {
    try {
      const nova = await pedirToken({ refresh_token: atual.refresh }, 'refresh_token');
      guardar(nova);
      return nova;
    } catch {
      // Refresh vencido ou revogado: volta a ser visitante, sem drama.
      guardar(null);
      return null;
    } finally {
      renovacao = null;
    }
  })();

  return renovacao;
}

/**
 * Token válido para usar no cabeçalho Authorization, ou null se não há
 * ninguém logado. Renova sozinho quando está perto de vencer.
 */
export async function tokenValido(): Promise<string | null> {
  const atual = sessaoAtual;
  if (!atual) return null;
  if (atual.expira_em - Date.now() > FOLGA_MS) return atual.token;
  return (await renovar())?.token ?? null;
}
