/* ---------------------------------------------------------------------
 * Armazém Supabase.
 *
 * Falamos direto com a API REST (PostgREST) via fetch, sem biblioteca:
 * como as contas dos indicadores são feitas aqui no navegador, tudo que
 * o banco precisa fazer é guardar e devolver linhas. Isso evita mais uma
 * dependência e qualquer surpresa de versão.
 *
 * A chave "publishable" fica no navegador de propósito — é assim que o
 * Supabase funciona. Quem protege os dados são as políticas (RLS) do
 * arquivo supabase/schema.sql.
 * ------------------------------------------------------------------ */

import { ErroApi } from './api';
import { bancoVazio, type Banco, type Registro } from './calculos';
import type { Armazem } from './armazem';

const URL_BASE = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
const CHAVE = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

/** O modo Supabase só liga quando as duas variáveis existem. */
export const supabaseConfigurado = Boolean(URL_BASE && CHAVE);

const TABELAS_TODAS = [
  'setores',
  'maquinas',
  'motivos',
  'tecnicos',
  'turnos',
  'ocorrencias',
] as const;

function cabecalhos(extras: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: CHAVE!,
    Authorization: `Bearer ${CHAVE}`,
    'Content-Type': 'application/json',
    ...extras,
  };
}

/** Traduz os erros do PostgREST para algo que a pessoa entenda. */
function traduzirErro(status: number, corpo: any): ErroApi {
  const msg = String(corpo?.message ?? '');
  const codigo = String(corpo?.code ?? '');

  if (codigo === 'PGRST205' || msg.includes('schema cache')) {
    return new ErroApi(
      'As tabelas ainda não existem no Supabase. Abra o SQL Editor do projeto e rode o ' +
        'arquivo supabase/schema.sql do repositório.',
      503,
    );
  }
  if (codigo === '23505' || msg.includes('duplicate key')) {
    return new ErroApi('Já existe outro registro com esse nome/código.', 409);
  }
  if (codigo === '23503') {
    return new ErroApi(
      'Este registro está em uso por uma ocorrência e não pode ser excluído.',
      409,
    );
  }
  if (codigo === '23514' || msg.includes('violates check constraint')) {
    return new ErroApi('Algum valor não é aceito pelo banco. Confira os campos.', 400);
  }
  if (status === 401 || status === 403) {
    return new ErroApi(
      'O Supabase recusou o acesso. Confira a chave (VITE_SUPABASE_KEY) e as políticas de ' +
        'segurança (RLS) das tabelas.',
      status,
    );
  }
  return new ErroApi(msg || `Falha ao falar com o Supabase (${status}).`, status);
}

async function requisicao(caminho: string, init?: RequestInit): Promise<any> {
  if (!supabaseConfigurado) {
    throw new ErroApi(
      'Supabase não configurado: faltam VITE_SUPABASE_URL e VITE_SUPABASE_KEY.',
      503,
    );
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
      ...init,
      headers: cabecalhos(init?.headers as Record<string, string>),
    });
  } catch {
    throw new ErroApi(
      'Não foi possível falar com o Supabase. Verifique a conexão com a internet.',
      0,
    );
  }

  const texto = await resposta.text();
  const corpo = texto ? JSON.parse(texto) : null;

  if (!resposta.ok) throw traduzirErro(resposta.status, corpo);
  return corpo;
}

export const armazemSupabase: Armazem = {
  rotulo: 'Supabase',

  async carregar(): Promise<Banco> {
    // Uma requisição por tabela, todas em paralelo. Os cadastros são
    // pequenos; as ocorrências vêm inteiras porque as contas dos
    // indicadores acontecem aqui no navegador.
    const respostas = await Promise.all(
      TABELAS_TODAS.map((t) => requisicao(`${t}?select=*`) as Promise<Registro[]>),
    );

    const banco = bancoVazio();
    TABELAS_TODAS.forEach((tabela, i) => {
      (banco as any)[tabela] = respostas[i] ?? [];
    });
    return banco;
  },

  async inserir(tabela, dados) {
    const linhas = await requisicao(tabela, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(dados),
    });
    return linhas?.[0] ?? dados;
  },

  async atualizar(tabela, id, dados) {
    const linhas = await requisicao(`${tabela}?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(dados),
    });
    if (!linhas?.length) throw new ErroApi('Registro não encontrado', 404);
    return linhas[0];
  },

  async excluir(tabela, id) {
    await requisicao(`${tabela}?id=eq.${id}`, { method: 'DELETE' });
  },
};
