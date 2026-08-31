/* ---------------------------------------------------------------------
 * Roteador.
 *
 * Responde às mesmas rotas que o backend respondia ("/ocorrencias",
 * "/indicadores/resumo", ...) e devolve os mesmos formatos de JSON, mas
 * lendo e gravando através de um Armazém. As telas continuam chamando
 * api.get('/ocorrencias') sem saber de nada disso.
 * ------------------------------------------------------------------ */

import { ErroApi } from './api';
import type { Armazem } from './armazem';
import {
  agora,
  CAMPOS,
  checarDuplicado,
  contarUsos,
  enriquecer,
  listarOcorrencias,
  ordenar,
  paraBanco,
  ROTULOS,
  rotasIndicadores,
  rotasTa,
  TABELAS,
  turnoDoHorario,
  validarLinhaDoTempo,
  type Params,
  type Registro,
  type Tabela,
} from './calculos';

export async function rotear(
  armazem: Armazem,
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  caminho: string,
  params: Params = {},
  corpo: Registro = {},
): Promise<unknown> {
  const partes = caminho.split('?')[0].split('/').filter(Boolean);
  const banco = await armazem.carregar();

  /* ---------------- health ---------------- */
  if (partes[0] === 'health') {
    return {
      ok: true,
      servico: 'Controle de Manutenção',
      armazem: armazem.rotulo,
      ocorrencias: banco.ocorrencias.length,
      hora: new Date().toISOString(),
    };
  }

  /* ---------------- lookups ---------------- */
  if (partes[0] === 'lookups') {
    const tabela = partes[1] as Tabela | undefined;

    if (!tabela) {
      const somenteAtivos = params.ativos === '1' || params.ativos === 1;
      const saida: Record<string, unknown> = {};
      for (const t of TABELAS) {
        saida[t] = ordenar(t, somenteAtivos ? banco[t].filter((r) => r.ativo === 1) : banco[t]);
      }
      return saida;
    }

    if (!TABELAS.includes(tabela)) throw new ErroApi('Cadastro não encontrado', 404);

    if (metodo === 'GET' && !partes[2]) return ordenar(tabela, banco[tabela]);

    if (metodo === 'POST') {
      const dados: Registro = { ativo: 1 };
      for (const campo of CAMPOS[tabela]) {
        if (corpo[campo] !== undefined) dados[campo] = corpo[campo];
      }
      if (!String(dados.nome ?? dados.codigo ?? '').trim()) {
        throw new ErroApi('Preencha os campos obrigatórios.', 400);
      }
      checarDuplicado(banco, tabela, dados);
      return armazem.inserir(tabela, dados);
    }

    const id = Number(partes[2]);
    const alvo = banco[tabela].find((r) => r.id === id);
    if (!alvo) throw new ErroApi(`${ROTULOS[tabela]} não encontrado`, 404);

    if (metodo === 'PUT') {
      const dados: Registro = {};
      for (const campo of CAMPOS[tabela]) {
        if (corpo[campo] !== undefined) dados[campo] = corpo[campo];
      }
      checarDuplicado(banco, tabela, dados, id);
      return armazem.atualizar(tabela, id, dados);
    }

    if (metodo === 'DELETE') {
      // Registro já usado vira inativo: apagar perderia o histórico.
      const usos = contarUsos(banco, tabela, id);
      if (usos > 0) {
        await armazem.atualizar(tabela, id, { ativo: 0 });
        return {
          ok: true,
          inativado: true,
          mensagem: `Este registro aparece em ${usos} lançamento(s). Foi inativado em vez de excluído, para o histórico e os indicadores continuarem corretos.`,
        };
      }
      await armazem.excluir(tabela, id);
      return { ok: true, inativado: false, mensagem: `${ROTULOS[tabela]} excluído.` };
    }
  }

  /* ---------------- ocorrencias ---------------- */
  if (partes[0] === 'ocorrencias') {
    if (metodo === 'GET' && !partes[1]) return listarOcorrencias(banco, params);

    if (metodo === 'POST' && !partes[1]) {
      const maquina_id = Number(corpo.maquina_id);
      if (!maquina_id || !banco.maquinas.some((m) => m.id === maquina_id)) {
        throw new ErroApi('Selecione a máquina', 400);
      }
      const descricao = String(corpo.descricao ?? '').trim();
      if (descricao.length < 3) throw new ErroApi('Descreva o que aconteceu', 400);

      const aberto = paraBanco(corpo.aberto_em as string) || agora();
      const atendido = paraBanco(corpo.atendido_em as string);
      const fim = paraBanco(corpo.fim_em as string);

      const erro = validarLinhaDoTempo(aberto, atendido, fim);
      if (erro) throw new ErroApi(erro, 400);

      const novo = await armazem.inserir('ocorrencias', {
        maquina_id,
        motivo_id: corpo.motivo_id ? Number(corpo.motivo_id) : null,
        tecnico_id: corpo.tecnico_id ? Number(corpo.tecnico_id) : null,
        turno_id: corpo.turno_id ? Number(corpo.turno_id) : turnoDoHorario(banco, aberto),
        tipo: corpo.tipo ?? 'Corretiva',
        prioridade: corpo.prioridade ?? 'Media',
        status: fim ? 'Concluida' : atendido ? 'Em atendimento' : 'Aberta',
        descricao,
        solucao: corpo.solucao ? String(corpo.solucao).trim() : null,
        parou_producao: corpo.parou_producao === 0 ? 0 : 1,
        aberto_em: aberto,
        atendido_em: atendido,
        fim_em: fim,
        atualizado_em: agora(),
      });

      return enriquecer(banco, novo);
    }

    const id = Number(partes[1]);
    const alvo = banco.ocorrencias.find((o) => o.id === id);
    if (!alvo) throw new ErroApi('Ocorrência não encontrada', 404);

    if (metodo === 'GET') return enriquecer(banco, alvo);

    if (metodo === 'DELETE') {
      await armazem.excluir('ocorrencias', id);
      return { ok: true, mensagem: 'Ocorrência excluída.' };
    }

    if (metodo === 'PUT') {
      const mudancas: Registro = {};

      for (const campo of ['maquina_id', 'motivo_id', 'tecnico_id', 'turno_id'] as const) {
        if (corpo[campo] !== undefined) mudancas[campo] = corpo[campo] ? Number(corpo[campo]) : null;
      }
      for (const campo of ['tipo', 'prioridade', 'status', 'descricao', 'solucao'] as const) {
        if (corpo[campo] !== undefined) mudancas[campo] = corpo[campo];
      }
      if (corpo.parou_producao !== undefined) mudancas.parou_producao = Number(corpo.parou_producao);
      for (const campo of ['aberto_em', 'atendido_em', 'fim_em'] as const) {
        if (corpo[campo] !== undefined) mudancas[campo] = paraBanco(corpo[campo] as string);
      }

      const futuro = { ...alvo, ...mudancas };
      const erro = validarLinhaDoTempo(futuro.aberto_em, futuro.atendido_em, futuro.fim_em);
      if (erro) throw new ErroApi(erro, 400);

      if (corpo.aberto_em !== undefined && corpo.turno_id === undefined) {
        mudancas.turno_id = turnoDoHorario(banco, futuro.aberto_em);
      }
      if (
        corpo.status === undefined &&
        (corpo.atendido_em !== undefined || corpo.fim_em !== undefined)
      ) {
        mudancas.status = futuro.fim_em
          ? 'Concluida'
          : futuro.atendido_em
            ? 'Em atendimento'
            : 'Aberta';
      }

      mudancas.atualizado_em = agora();
      return enriquecer(banco, await armazem.atualizar('ocorrencias', id, mudancas));
    }

    if (metodo === 'POST') {
      const acao = partes[2];

      if (acao === 'atender') {
        const quando = paraBanco(corpo.atendido_em as string) || agora();
        const erro = validarLinhaDoTempo(alvo.aberto_em, quando, alvo.fim_em);
        if (erro) throw new ErroApi(erro, 400);

        const mudancas: Registro = {
          atendido_em: quando,
          status: 'Em atendimento',
          atualizado_em: agora(),
        };
        if (corpo.tecnico_id) mudancas.tecnico_id = Number(corpo.tecnico_id);
        return enriquecer(banco, await armazem.atualizar('ocorrencias', id, mudancas));
      }

      if (acao === 'concluir') {
        const fim = paraBanco(corpo.fim_em as string) || agora();
        // Sem início registrado, usamos a abertura: assumir que começou
        // junto com o fim inventaria um TA de zero.
        const atendido =
          alvo.atendido_em || paraBanco(corpo.atendido_em as string) || alvo.aberto_em;

        const erro = validarLinhaDoTempo(alvo.aberto_em, atendido, fim);
        if (erro) throw new ErroApi(erro, 400);

        const mudancas: Registro = {
          fim_em: fim,
          atendido_em: atendido,
          status: 'Concluida',
          atualizado_em: agora(),
        };
        if (corpo.tecnico_id) mudancas.tecnico_id = Number(corpo.tecnico_id);
        const solucao = String(corpo.solucao ?? '').trim();
        if (solucao) mudancas.solucao = solucao;

        return enriquecer(banco, await armazem.atualizar('ocorrencias', id, mudancas));
      }

      if (acao === 'reabrir') {
        return enriquecer(
          banco,
          await armazem.atualizar('ocorrencias', id, {
            fim_em: null,
            status: alvo.atendido_em ? 'Em atendimento' : 'Aberta',
            atualizado_em: agora(),
          }),
        );
      }
    }
  }

  /* ---------------- ta ---------------- */
  if (partes[0] === 'ta') return rotasTa(banco, partes[1], params);

  /* ---------------- indicadores ---------------- */
  if (partes[0] === 'indicadores') return rotasIndicadores(banco, partes[1], params);

  throw new ErroApi(`Rota não encontrada: ${caminho}`, 404);
}
