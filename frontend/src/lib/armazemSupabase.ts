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
import { bancoVazio, normalizar, type Banco, type Registro } from './calculos';
import type { Armazem } from './armazem';
import { estaLogado, tokenValido } from './auth';

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

/**
 * Com administrador logado mandamos o token dele; sem ninguém logado, a
 * própria chave publishable. É essa diferença que o Postgres enxerga para
 * liberar (ou negar) cadastros e exclusões.
 */
async function cabecalhos(extras: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await tokenValido();
  return {
    apikey: CHAVE!,
    Authorization: `Bearer ${token ?? CHAVE}`,
    'Content-Type': 'application/json',
    ...extras,
  };
}

/**
 * Quando a regra de acesso do Postgres barra um UPDATE ou um DELETE, ele
 * não devolve erro: apenas não altera nada. Sem isto a tela diria
 * "excluído" sem ter excluído.
 */
function erroPermissao(acao: string): ErroApi {
  return new ErroApi(
    estaLogado()
      ? `Não foi possível ${acao}. O banco recusou a operação para o usuário atual.`
      : `Só o administrador pode ${acao}. Entre com a senha no menu lateral e tente de novo.`,
    403,
  );
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
  if (status === 401 || status === 403 || codigo === '42501') {
    // O banco barrou a operação. Quase sempre é falta de administrador
    // logado, não configuração errada — então a mensagem vai por aí.
    return new ErroApi(
      estaLogado()
        ? 'O banco recusou esta operação para o usuário atual. Confira as políticas de ' +
          'segurança (RLS) das tabelas no Supabase.'
        : 'Esta ação é só do administrador. Entre com a senha no menu lateral e tente de novo.',
      403,
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
      headers: await cabecalhos(init?.headers as Record<string, string>),
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

/**
 * Datas do Postgres chegam como "2026-08-29T08:00:00.123", enquanto o
 * resto do sistema usa "2026-08-29 08:00:00". Misturar os dois quebra as
 * comparações de texto: o espaço vem antes do "T" na tabela de
 * caracteres, então 08:12 pareceria anterior a 08:00. Padronizamos aqui,
 * na entrada, para nada depois precisar se preocupar com isso.
 */
const CAMPOS_DATA = ['aberto_em', 'atendido_em', 'fim_em', 'criado_em', 'atualizado_em'] as const;

function padronizarDatas(linha: Registro): Registro {
  const saida = { ...linha };
  for (const campo of CAMPOS_DATA) {
    if (campo in saida) saida[campo] = normalizar(saida[campo]);
  }
  return saida;
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
      (banco as any)[tabela] = (respostas[i] ?? []).map(padronizarDatas);
    });
    return banco;
  },

  async inserir(tabela, dados) {
    const linhas = await requisicao(tabela, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(dados),
    });
    return padronizarDatas(linhas?.[0] ?? dados);
  },

  async atualizar(tabela, id, dados) {
    const linhas = await requisicao(`${tabela}?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(dados),
    });
    // Zero linhas aqui quase sempre é a regra de acesso barrando: o
    // roteador só chega neste ponto depois de encontrar o registro.
    if (!linhas?.length) throw erroPermissao('alterar este registro');
    return padronizarDatas(linhas[0]);
  },

  async excluir(tabela, id) {
    const linhas = await requisicao(`${tabela}?id=eq.${id}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    });
    if (!linhas?.length) throw erroPermissao('excluir este registro');
  },
};
