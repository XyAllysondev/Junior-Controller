/* ---------------------------------------------------------------------
 * Armazém: o contrato de "onde os dados ficam".
 *
 * O roteador conversa só com esta interface, então trocar navegador por
 * Supabase (ou por outra coisa amanhã) não encosta nas telas nem nas
 * contas dos indicadores.
 * ------------------------------------------------------------------ */

import { ErroApi } from './api';
import { agora, bancoVazio, type Banco, type Registro, TABELAS } from './calculos';

export type Armazem = {
  /** Nome curto para aparecer no rodapé e no diagnóstico. */
  rotulo: string;
  carregar(): Promise<Banco>;
  inserir(tabela: string, dados: Registro): Promise<Registro>;
  atualizar(tabela: string, id: number, dados: Registro): Promise<Registro>;
  excluir(tabela: string, id: number): Promise<void>;
  /** Backup por arquivo — só faz sentido quando os dados são deste aparelho. */
  backup?: {
    exportar(): string;
    importar(conteudo: string): void;
    limpar(): void;
  };
};

/* ==================================================================== */
/* Navegador (localStorage)                                             */
/* ==================================================================== */

const CHAVE = 'manutencao-capricche-v1';

type BancoSalvo = Banco & { versao: number; sequencias: Record<string, number> };

function proximoId(banco: BancoSalvo, tabela: string): number {
  const proximo = (banco.sequencias[tabela] ?? 0) + 1;
  banco.sequencias[tabela] = proximo;
  return proximo;
}

/** Cadastros que são iguais em qualquer fábrica, para não começar do zero absoluto. */
function bancoInicial(): BancoSalvo {
  const banco: BancoSalvo = { ...bancoVazio(), versao: 1, sequencias: {} };

  for (const [nome, ini, fim] of [
    ['1º Turno', '06:00', '14:00'],
    ['2º Turno', '14:00', '22:00'],
    ['3º Turno', '22:00', '06:00'],
  ]) {
    banco.turnos.push({
      id: proximoId(banco, 'turnos'),
      nome,
      hora_inicio: ini,
      hora_fim: fim,
      ativo: 1,
      criado_em: agora(),
    });
  }

  const motivos: [string, string][] = [
    ['Rolamento danificado', 'Mecanica'],
    ['Correia rompida', 'Mecanica'],
    ['Desalinhamento de eixo', 'Mecanica'],
    ['Lubrificação programada', 'Mecanica'],
    ['Sensor com falha', 'Automacao'],
    ['Inversor de frequência em alarme', 'Eletrica'],
    ['Curto no painel', 'Eletrica'],
    ['Vazamento hidráulico', 'Hidraulica'],
    ['Pressão de ar insuficiente', 'Pneumatica'],
    ['Cilindro pneumático travado', 'Pneumatica'],
    ['Falha de operação', 'Operacional'],
    ['Troca de ferramental', 'Setup'],
    ['Ajuste de qualidade', 'Qualidade'],
  ];
  for (const [nome, categoria] of motivos) {
    banco.motivos.push({
      id: proximoId(banco, 'motivos'),
      nome,
      categoria,
      ativo: 1,
      criado_em: agora(),
    });
  }

  return banco;
}

let cache: BancoSalvo | null = null;

function ler(): BancoSalvo {
  if (cache) return cache;
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      cache = JSON.parse(bruto) as BancoSalvo;
      return cache;
    }
  } catch {
    /* storage indisponível ou conteúdo corrompido: começa do zero */
  }
  cache = bancoInicial();
  gravar(cache);
  return cache;
}

function gravar(banco: BancoSalvo): void {
  cache = banco;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(banco));
  } catch {
    throw new ErroApi(
      'Não foi possível salvar. O armazenamento do navegador pode estar cheio ou bloqueado ' +
        '(janela anônima, por exemplo).',
      507,
    );
  }
}

export const armazemNavegador: Armazem = {
  rotulo: 'navegador',

  async carregar() {
    return ler();
  },

  async inserir(tabela, dados) {
    const banco = ler();
    const registro = { id: proximoId(banco, tabela), ...dados, criado_em: agora() };
    (banco as any)[tabela].push(registro);
    gravar(banco);
    return registro;
  },

  async atualizar(tabela, id, dados) {
    const banco = ler();
    const alvo = (banco as any)[tabela].find((r: Registro) => r.id === id);
    if (!alvo) throw new ErroApi('Registro não encontrado', 404);
    Object.assign(alvo, dados);
    gravar(banco);
    return alvo;
  },

  async excluir(tabela, id) {
    const banco = ler();
    (banco as any)[tabela] = (banco as any)[tabela].filter((r: Registro) => r.id !== id);
    gravar(banco);
  },

  backup: {
    exportar: () => JSON.stringify(ler(), null, 2),

    importar(conteudo) {
      const dados = JSON.parse(conteudo) as BancoSalvo;
      if (!dados || typeof dados !== 'object' || !Array.isArray(dados.ocorrencias)) {
        throw new ErroApi('Arquivo inválido: não parece um backup deste sistema.', 400);
      }
      for (const t of [...TABELAS, 'ocorrencias'] as const) {
        if (!Array.isArray((dados as any)[t])) (dados as any)[t] = [];
      }
      dados.sequencias ??= {};
      // Garante que os próximos ids não colidam com o que veio no arquivo.
      for (const t of [...TABELAS, 'ocorrencias'] as const) {
        const maior = (dados as any)[t].reduce(
          (m: number, r: Registro) => Math.max(m, r.id ?? 0),
          0,
        );
        dados.sequencias[t] = Math.max(dados.sequencias[t] ?? 0, maior);
      }
      gravar(dados);
    },

    limpar() {
      cache = bancoInicial();
      gravar(cache);
    },
  },
};
