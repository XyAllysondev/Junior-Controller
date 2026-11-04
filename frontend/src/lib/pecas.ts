/* ---------------------------------------------------------------------
 * Estoque de peças.
 *
 * Fica separado do roteador e dos demais cadastros de propósito: o
 * roteador recarrega o banco inteiro a cada chamada, e somar milhares de
 * peças a isso deixaria todas as telas lentas. Aqui as peças são lidas
 * uma vez, só quando a aba Peças é aberta.
 * ------------------------------------------------------------------ */

import { ErroApi, MODO_SERVIDOR, MODO_SUPABASE } from './api';
import { agora } from './calculos';

export type Peca = {
  id: number;
  codigo: string;
  descricao: string;
  posicao: string | null;
  categoria: string | null;
  linha: string | null;
  maquina_id: number | null;
  ativo: number;
  criado_em: string;
};

export type DadosPeca = Partial<Omit<Peca, 'id' | 'criado_em'>>;

type ArmazemPecas = {
  listar(): Promise<Peca[]>;
  inserir(dados: DadosPeca): Promise<Peca>;
  atualizar(id: number, dados: DadosPeca): Promise<Peca>;
  excluir(id: number): Promise<void>;
};

/* ==================================================================== */
/* Supabase                                                             */
/* ==================================================================== */

/** O Supabase devolve no máximo 1000 linhas por consulta. */
const PAGINA_SUPABASE = 1000;

async function supabase(): Promise<ArmazemPecas> {
  const { requisicao } = await import('./armazemSupabase');

  const semPermissao = (acao: string) =>
    new ErroApi(
      `Não foi possível ${acao}. Só o administrador pode mexer no estoque de peças — ` +
        'entre com a senha no menu lateral.',
      403,
    );

  return {
    async listar() {
      const todas: Peca[] = [];
      for (let inicio = 0; ; inicio += PAGINA_SUPABASE) {
        const lote = (await requisicao(
          `pecas?select=*&order=id.asc&offset=${inicio}&limit=${PAGINA_SUPABASE}`,
        )) as Peca[];
        todas.push(...lote);
        if (lote.length < PAGINA_SUPABASE) return todas;
      }
    },
    async inserir(dados) {
      const linhas = await requisicao('pecas', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(dados),
      });
      return linhas[0];
    },
    async atualizar(id, dados) {
      const linhas = await requisicao(`pecas?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(dados),
      });
      if (!linhas?.length) throw semPermissao('alterar esta peça');
      return linhas[0];
    },
    async excluir(id) {
      const linhas = await requisicao(`pecas?id=eq.${id}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
      });
      if (!linhas?.length) throw semPermissao('excluir esta peça');
    },
  };
}

/* ==================================================================== */
/* Navegador (localStorage)                                             */
/* ==================================================================== */

const CHAVE = 'manutencao-capricche-pecas-v1';
type Salvo = { sequencia: number; itens: Peca[] };

function ler(): Salvo {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto) as Salvo;
  } catch {
    /* conteúdo corrompido: começa do zero */
  }
  return { sequencia: 0, itens: [] };
}

function gravar(salvo: Salvo) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(salvo));
  } catch {
    throw new ErroApi('Não foi possível salvar. O armazenamento do navegador pode estar cheio.', 507);
  }
}

const navegador: ArmazemPecas = {
  async listar() {
    return ler().itens;
  },
  async inserir(dados) {
    const salvo = ler();
    const peca = { ativo: 1, ...dados, id: ++salvo.sequencia, criado_em: agora() } as Peca;
    salvo.itens.push(peca);
    gravar(salvo);
    return peca;
  },
  async atualizar(id, dados) {
    const salvo = ler();
    const alvo = salvo.itens.find((p) => p.id === id);
    if (!alvo) throw new ErroApi('Peça não encontrada', 404);
    Object.assign(alvo, dados);
    gravar(salvo);
    return alvo;
  },
  async excluir(id) {
    const salvo = ler();
    salvo.itens = salvo.itens.filter((p) => p.id !== id);
    gravar(salvo);
  },
};

/* ==================================================================== */

let armazem: Promise<ArmazemPecas> | null = null;

export function armazemPecas(): Promise<ArmazemPecas> {
  if (MODO_SERVIDOR) {
    return Promise.reject(
      new ErroApi('O estoque de peças funciona no modo Supabase ou navegador, não no modo servidor.', 501),
    );
  }
  armazem ??= MODO_SUPABASE ? supabase() : Promise.resolve(navegador);
  return armazem;
}

/** Deixa o texto como a planilha: sem espaços sobrando; vazio vira null. */
export function limparPeca(dados: Record<string, string | undefined>): DadosPeca {
  const t = (v?: string) => {
    const s = (v ?? '').replace(/\s+/g, ' ').trim();
    return s || null;
  };
  return {
    codigo: t(dados.codigo) ?? '',
    descricao: t(dados.descricao) ?? '',
    posicao: t(dados.posicao),
    categoria: t(dados.categoria)?.toUpperCase() ?? null,
    linha: t(dados.linha),
    maquina_id: dados.maquina_id ? Number(dados.maquina_id) : null,
  };
}
