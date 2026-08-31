import { useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  PlayCircle,
  Plus,
  Search,
  SlidersHorizontal,
  SquarePen,
  Trash2,
} from 'lucide-react';

import { TituloPagina } from '../components/Layout';
import { FormularioOcorrencia } from '../components/FormularioOcorrencia';
import {
  Alerta,
  AreaTexto,
  Botao,
  Campo,
  Carregando,
  Cartao,
  cx,
  Entrada,
  Etiqueta,
  EstadoVazio,
  Modal,
  Selecao,
  useAviso,
} from '../components/ui';
import { api, ErroApi, type ListaOcorrencias, type Ocorrencia, type StatusOcorrencia } from '../lib/api';
import { somenteAtivos, useLookups } from '../lib/dados';
import { useApi, useDebounce } from '../lib/hooks';
import * as fmt from '../lib/formato';
import { TOM_PRIORIDADE, TOM_STATUS, TOM_TIPO } from '../lib/visual';

const STATUS: (StatusOcorrencia | 'todos')[] = [
  'todos',
  'Aberta',
  'Em atendimento',
  'Concluida',
  'Cancelada',
];

const ROTULO_STATUS: Record<string, string> = {
  todos: 'Todas',
  Aberta: 'Abertas',
  'Em atendimento': 'Em atendimento',
  Concluida: 'Concluídas',
  Cancelada: 'Canceladas',
};

type FiltrosLista = {
  busca: string;
  status: string;
  prioridade: string;
  tipo: string;
  setor_id: string;
  maquina_id: string;
  de: string;
  ate: string;
  pagina: number;
};

const filtrosIniciais: FiltrosLista = {
  busca: '',
  status: 'todos',
  prioridade: 'todos',
  tipo: 'todos',
  setor_id: 'todos',
  maquina_id: 'todos',
  de: '',
  ate: '',
  pagina: 1,
};

export function Ocorrencias() {
  const { lookups } = useLookups();
  const avisar = useAviso();

  const [filtros, setFiltros] = useState<FiltrosLista>(filtrosIniciais);
  const [maisFiltros, setMaisFiltros] = useState(false);
  const buscaAtrasada = useDebounce(filtros.busca);

  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Ocorrencia | null>(null);
  const [paraConcluir, setParaConcluir] = useState<Ocorrencia | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Ocorrencia | null>(null);

  const consulta = { ...filtros, busca: buscaAtrasada, porPagina: 20 };
  const { dados, carregando, erro, recarregar } = useApi<ListaOcorrencias>(
    () => api.get<ListaOcorrencias>('/ocorrencias', consulta),
    JSON.stringify(consulta),
  );

  const definir = <K extends keyof FiltrosLista>(campo: K, valor: FiltrosLista[K]) =>
    setFiltros((f) => ({ ...f, [campo]: valor, pagina: campo === 'pagina' ? (valor as number) : 1 }));

  async function atender(o: Ocorrencia) {
    try {
      await api.post(`/ocorrencias/${o.id}/atender`, {});
      avisar(`Atendimento iniciado na ${o.maquina_codigo}.`);
      recarregar();
    } catch (e) {
      avisar(e instanceof ErroApi ? e.message : 'Falha ao iniciar o atendimento.', 'erro');
    }
  }

  async function excluir() {
    if (!paraExcluir) return;
    try {
      await api.del(`/ocorrencias/${paraExcluir.id}`);
      avisar('Ocorrência excluída.');
      setParaExcluir(null);
      recarregar();
    } catch (e) {
      avisar(e instanceof ErroApi ? e.message : 'Falha ao excluir.', 'erro');
    }
  }

  const maquinasVisiveis = somenteAtivos(lookups.maquinas).filter(
    (m) => filtros.setor_id === 'todos' || String(m.setor_id) === filtros.setor_id,
  );

  return (
    <>
      <TituloPagina
        titulo="Ocorrências"
        descricao="Registro de paradas e chamados de manutenção. Use os botões de ação para iniciar o atendimento e encerrar o chamado."
        acoes={
          <Botao
            icone={<Plus className="size-4" aria-hidden />}
            onClick={() => {
              setEmEdicao(null);
              setFormAberto(true);
            }}
          >
            Nova ocorrência
          </Botao>
        }
      />

      {/* ------------------------- Filtros ------------------------- */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Entrada
              type="search"
              value={filtros.busca}
              onChange={(e) => definir('busca', e.target.value)}
              placeholder="Buscar por descrição, solução, código ou nome da máquina"
              aria-label="Buscar ocorrências"
              className="pl-9"
            />
          </div>
          <Botao
            variante="secundario"
            icone={<SlidersHorizontal className="size-4" aria-hidden />}
            onClick={() => setMaisFiltros((v) => !v)}
            aria-expanded={maisFiltros}
          >
            {maisFiltros ? 'Ocultar filtros' : 'Mais filtros'}
          </Botao>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
          {STATUS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={filtros.status === s}
              onClick={() => definir('status', s)}
              className={cx(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                filtros.status === s
                  ? 'bg-marca-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              )}
            >
              {ROTULO_STATUS[s]}
            </button>
          ))}
        </div>

        {maisFiltros && (
          <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 dark:border-slate-800">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Setor</span>
              <Selecao
                value={filtros.setor_id}
                onChange={(e) =>
                  setFiltros((f) => ({
                    ...f,
                    setor_id: e.target.value,
                    maquina_id: 'todos',
                    pagina: 1,
                  }))
                }
              >
                <option value="todos">Todos</option>
                {somenteAtivos(lookups.setores).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </Selecao>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Máquina</span>
              <Selecao
                value={filtros.maquina_id}
                onChange={(e) => definir('maquina_id', e.target.value)}
              >
                <option value="todos">Todas</option>
                {maquinasVisiveis.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo}
                  </option>
                ))}
              </Selecao>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Prioridade
              </span>
              <Selecao
                value={filtros.prioridade}
                onChange={(e) => definir('prioridade', e.target.value)}
              >
                <option value="todos">Todas</option>
                <option value="Critica">Crítica</option>
                <option value="Alta">Alta</option>
                <option value="Media">Média</option>
                <option value="Baixa">Baixa</option>
              </Selecao>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tipo</span>
              <Selecao value={filtros.tipo} onChange={(e) => definir('tipo', e.target.value)}>
                <option value="todos">Todos</option>
                <option value="Corretiva">Corretiva</option>
                <option value="Preventiva">Preventiva</option>
                <option value="Preditiva">Preditiva</option>
                <option value="Melhoria">Melhoria</option>
              </Selecao>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">De</span>
              <Entrada type="date" value={filtros.de} onChange={(e) => definir('de', e.target.value)} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Até</span>
              <Entrada
                type="date"
                value={filtros.ate}
                onChange={(e) => definir('ate', e.target.value)}
              />
            </label>

            <div className="sm:col-span-2 lg:col-span-3 xl:col-span-6">
              <Botao variante="fantasma" tamanho="pequeno" onClick={() => setFiltros(filtrosIniciais)}>
                Limpar todos os filtros
              </Botao>
            </div>
          </div>
        )}
      </div>

      {erro && (
        <div className="mb-6">
          <Alerta titulo="Erro ao carregar as ocorrências">
            <p>{erro}</p>
            <Botao variante="secundario" tamanho="pequeno" className="mt-3" onClick={recarregar}>
              Tentar de novo
            </Botao>
          </Alerta>
        </div>
      )}

      {/* ------------------------- Lista ------------------------- */}
      <Cartao
        semPadding
        titulo={dados ? `${fmt.numero(dados.total)} ocorrência(s)` : 'Ocorrências'}
        subtitulo={dados && dados.paginas > 1 ? `Página ${dados.pagina} de ${dados.paginas}` : undefined}
      >
        {carregando ? (
          <Carregando texto="Buscando ocorrências..." />
        ) : !dados || dados.itens.length === 0 ? (
          <EstadoVazio
            icone={<ClipboardList className="size-7" aria-hidden />}
            titulo="Nenhuma ocorrência encontrada"
            descricao="Ajuste os filtros acima ou registre a primeira parada desta máquina."
            acao={
              <Botao
                icone={<Plus className="size-4" aria-hidden />}
                onClick={() => {
                  setEmEdicao(null);
                  setFormAberto(true);
                }}
              >
                Nova ocorrência
              </Botao>
            }
          />
        ) : (
          <>
            {/* Tabela (telas grandes) */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[940px] text-sm">
                <caption className="sr-only">Lista de ocorrências de manutenção</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-bold tracking-wide text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
                    <th scope="col" className="px-4 py-3">Máquina</th>
                    <th scope="col" className="px-4 py-3">Ocorrência</th>
                    <th scope="col" className="px-4 py-3">Situação</th>
                    <th scope="col" className="px-4 py-3">Abertura e tempos</th>
                    <th
                      scope="col"
                      className="sticky right-0 z-10 border-l border-slate-200 bg-white px-4 py-3 text-right whitespace-nowrap shadow-[-10px_0_14px_-10px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900"
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dados.itens.map((o) => (
                    <tr key={o.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 align-top">
                        <span className="block font-mono text-xs font-bold text-marca-600 dark:text-marca-400">
                          {o.maquina_codigo}
                        </span>
                        <span className="block font-semibold text-slate-800 dark:text-slate-100">
                          {o.maquina_nome}
                        </span>
                        <span className="block text-xs text-slate-400">{o.setor_nome}</span>
                      </td>
                      <td className="max-w-[240px] px-4 py-3 align-top">
                        <p className="truncate font-medium text-slate-700 dark:text-slate-200" title={o.descricao}>
                          {o.descricao}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Etiqueta tom={TOM_TIPO[o.tipo]}>{o.tipo}</Etiqueta>
                          {o.motivo_nome && <Etiqueta>{o.motivo_nome}</Etiqueta>}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col items-start gap-1.5">
                          <Etiqueta tom={TOM_STATUS[o.status]}>{o.status}</Etiqueta>
                          <Etiqueta tom={TOM_PRIORIDADE[o.prioridade]}>{o.prioridade}</Etiqueta>
                        </div>
                      </td>
                      {/* Abertura, turno e os dois tempos na mesma coluna: e a
                          linha do tempo do chamado, e economiza largura. */}
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-600 dark:text-slate-300">
                        <span className="block font-medium tabular-nums text-slate-700 dark:text-slate-200">
                          {fmt.dataHoraCurta(o.aberto_em)}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {o.turno_nome ?? 'Sem turno'}
                        </span>
                        <span className="mt-1 block text-xs tabular-nums">
                          <span className="font-semibold text-slate-400">TA</span>{' '}
                          {o.ta_min === null ? (
                            <span className="font-semibold text-ouro-700 dark:text-ouro-300">
                              {fmt.decorridoDesde(o.aberto_em)}
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-300">
                              {fmt.minutos(o.ta_min)}
                            </span>
                          )}
                          <span className="mx-1 text-slate-300 dark:text-slate-600">·</span>
                          <span className="font-semibold text-slate-400">Reparo</span>{' '}
                          <span className="text-slate-600 dark:text-slate-300">
                            {fmt.minutos(o.reparo_min)}
                          </span>
                        </span>
                      </td>
                      <td className="sticky right-0 z-10 w-px border-l border-slate-200 bg-white px-4 py-3 align-top whitespace-nowrap shadow-[-10px_0_14px_-10px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900">
                        <Acoes
                          o={o}
                          aoAtender={() => atender(o)}
                          aoConcluir={() => setParaConcluir(o)}
                          aoEditar={() => {
                            setEmEdicao(o);
                            setFormAberto(true);
                          }}
                          aoExcluir={() => setParaExcluir(o)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartões (celular e tablet) */}
            <ul className="divide-y divide-slate-100 lg:hidden dark:divide-slate-800">
              {dados.itens.map((o) => (
                <li key={o.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-marca-600 dark:text-marca-400">
                      {o.maquina_codigo}
                    </span>
                    <Etiqueta tom={TOM_STATUS[o.status]}>{o.status}</Etiqueta>
                    <Etiqueta tom={TOM_PRIORIDADE[o.prioridade]}>{o.prioridade}</Etiqueta>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{o.maquina_nome}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{o.descricao}</p>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500 uppercase">Abertura</dt>
                      <dd className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {fmt.dataHoraCurta(o.aberto_em)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500 uppercase">TA</dt>
                      <dd className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {o.ta_min === null ? fmt.decorridoDesde(o.aberto_em) : fmt.minutos(o.ta_min)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold text-slate-500 uppercase">Reparo</dt>
                      <dd className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {fmt.minutos(o.reparo_min)}
                      </dd>
                    </div>
                  </dl>
                  <Acoes
                    o={o}
                    aoAtender={() => atender(o)}
                    aoConcluir={() => setParaConcluir(o)}
                    aoEditar={() => {
                      setEmEdicao(o);
                      setFormAberto(true);
                    }}
                    aoExcluir={() => setParaExcluir(o)}
                  />
                </li>
              ))}
            </ul>

            {/* Paginação */}
            {dados.paginas > 1 && (
              <nav
                aria-label="Paginação das ocorrências"
                className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800"
              >
                <Botao
                  variante="secundario"
                  tamanho="pequeno"
                  disabled={dados.pagina <= 1}
                  onClick={() => definir('pagina', dados.pagina - 1)}
                  icone={<ChevronLeft className="size-4" aria-hidden />}
                >
                  Anterior
                </Botao>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Página {dados.pagina} de {dados.paginas}
                </span>
                <Botao
                  variante="secundario"
                  tamanho="pequeno"
                  disabled={dados.pagina >= dados.paginas}
                  onClick={() => definir('pagina', dados.pagina + 1)}
                >
                  Próxima <ChevronRight className="size-4" aria-hidden />
                </Botao>
              </nav>
            )}
          </>
        )}
      </Cartao>

      {/* ------------------------- Modais ------------------------- */}
      <FormularioOcorrencia
        aberto={formAberto}
        aoFechar={() => setFormAberto(false)}
        aoSalvar={recarregar}
        registro={emEdicao}
      />

      <ModalConcluir
        ocorrencia={paraConcluir}
        aoFechar={() => setParaConcluir(null)}
        aoConcluir={recarregar}
      />

      <Modal
        aberto={Boolean(paraExcluir)}
        aoFechar={() => setParaExcluir(null)}
        titulo="Excluir ocorrência"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaExcluir(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={excluir} icone={<Trash2 className="size-4" aria-hidden />}>
              Excluir definitivamente
            </Botao>
          </>
        }
        largura="max-w-lg"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          A ocorrência <strong>#{paraExcluir?.id}</strong> da máquina{' '}
          <strong>{paraExcluir?.maquina_codigo}</strong> será removida do histórico e deixará de
          contar nos indicadores. Essa ação não pode ser desfeita.
        </p>
      </Modal>
    </>
  );
}

/* ==================================================================== */
/* Botoes de acao de cada ocorrencia                                    */
/* ==================================================================== */
function Acoes({
  o,
  aoAtender,
  aoConcluir,
  aoEditar,
  aoExcluir,
}: {
  o: Ocorrencia;
  aoAtender: () => void;
  aoConcluir: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 lg:flex-nowrap">
      {o.status === 'Aberta' && (
        <Botao
          tamanho="pequeno"
          variante="secundario"
          onClick={aoAtender}
          icone={<PlayCircle className="size-4" aria-hidden />}
          title="Marcar que a manutenção chegou na máquina agora"
        >
          Atender
        </Botao>
      )}
      {o.status !== 'Concluida' && o.status !== 'Cancelada' && (
        <Botao
          tamanho="pequeno"
          variante="sucesso"
          onClick={aoConcluir}
          icone={<CheckCircle2 className="size-4" aria-hidden />}
        >
          Concluir
        </Botao>
      )}
      <Botao
        tamanho="pequeno"
        variante="fantasma"
        onClick={aoEditar}
        aria-label={`Editar ocorrência ${o.id}`}
        title="Editar"
      >
        <SquarePen className="size-4" aria-hidden />
      </Botao>
      <Botao
        tamanho="pequeno"
        variante="fantasma"
        onClick={aoExcluir}
        aria-label={`Excluir ocorrência ${o.id}`}
        title="Excluir"
        className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
      >
        <Trash2 className="size-4" aria-hidden />
      </Botao>
    </div>
  );
}

/* ==================================================================== */
/* Modal de conclusao                                                   */
/* ==================================================================== */
function ModalConcluir({
  ocorrencia,
  aoFechar,
  aoConcluir,
}: {
  ocorrencia: Ocorrencia | null;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const { lookups } = useLookups();
  const avisar = useAviso();

  const [fim, setFim] = useState('');
  const [atendido, setAtendido] = useState('');
  const [solucao, setSolucao] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Prepara os campos quando o modal abre
  const [ultimoId, setUltimoId] = useState<number | null>(null);
  if (ocorrencia && ocorrencia.id !== ultimoId) {
    setUltimoId(ocorrencia.id);
    setFim(fmt.agoraInput());
    setAtendido(fmt.paraInput(ocorrencia.atendido_em) || fmt.paraInput(ocorrencia.aberto_em));
    setSolucao(ocorrencia.solucao ?? '');
    setTecnico(ocorrencia.tecnico_id ? String(ocorrencia.tecnico_id) : '');
  }

  async function enviar() {
    if (!ocorrencia) return;
    setSalvando(true);
    try {
      await api.post(`/ocorrencias/${ocorrencia.id}/concluir`, {
        fim_em: fim,
        atendido_em: atendido || null,
        solucao: solucao.trim() || null,
        tecnico_id: tecnico || null,
      });
      avisar(`Chamado da ${ocorrencia.maquina_codigo} encerrado.`);
      aoConcluir();
      aoFechar();
    } catch (e) {
      avisar(e instanceof ErroApi ? e.message : 'Falha ao concluir o chamado.', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={Boolean(ocorrencia)}
      aoFechar={aoFechar}
      titulo="Concluir chamado"
      descricao={
        ocorrencia
          ? `${ocorrencia.maquina_codigo} — ${ocorrencia.maquina_nome}`
          : undefined
      }
      largura="max-w-xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="sucesso"
            onClick={enviar}
            carregando={salvando}
            icone={<CheckCircle2 className="size-4" aria-hidden />}
          >
            Liberar máquina
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          Chamado aberto em <strong>{fmt.dataHora(ocorrencia?.aberto_em)}</strong>
          {ocorrencia?.motivo_nome && (
            <>
              {' · '}
              {ocorrencia.motivo_nome}
            </>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Início do atendimento"
            dica="Quando a manutenção chegou na máquina."
          >
            {(id) => (
              <Entrada
                id={id}
                type="datetime-local"
                value={atendido}
                onChange={(e) => setAtendido(e.target.value)}
              />
            )}
          </Campo>

          <Campo rotulo="Fim do reparo" obrigatorio>
            {(id) => (
              <Entrada
                id={id}
                type="datetime-local"
                value={fim}
                min={atendido || undefined}
                onChange={(e) => setFim(e.target.value)}
              />
            )}
          </Campo>
        </div>

        <Campo rotulo="Técnico responsável">
          {(id) => (
            <Selecao id={id} value={tecnico} onChange={(e) => setTecnico(e.target.value)}>
              <option value="">Não atribuído</option>
              {somenteAtivos(lookups.tecnicos).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>

        <Campo rotulo="O que foi feito" dica="Fica registrado no histórico da máquina.">
          {(id) => (
            <AreaTexto
              id={id}
              value={solucao}
              onChange={(e) => setSolucao(e.target.value)}
              placeholder="Ex.: correia substituída e tensionamento ajustado"
            />
          )}
        </Campo>
      </div>
    </Modal>
  );
}
