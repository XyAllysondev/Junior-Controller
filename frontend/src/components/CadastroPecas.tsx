import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Package, Plus, Save, Search, SquarePen, Trash2 } from 'lucide-react';

import {
  Alerta,
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
} from './ui';
import { ErroApi } from '../lib/api';
import { useLookups } from '../lib/dados';
import { armazemPecas, limparPeca, type Peca, type TabelaPecas } from '../lib/pecas';

const POR_PAGINA = 50;

const SEM_ACENTO = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Arquivo que cria e carrega cada tabela de peças no Supabase. */
const SQL_DA_TABELA: Record<TabelaPecas, string> = {
  pecas: 'supabase/importar_pecas.sql',
  pecas_mesanino: 'supabase/importar_pecas_mesanino.sql',
};

function mensagemErro(e: unknown, padrao: string, tabela: TabelaPecas): string {
  if (!(e instanceof ErroApi)) return padrao;
  // Tabela ainda não criada no Supabase: aponta o arquivo certo.
  if (e.status === 503 && e.message.includes('tabelas')) {
    return (
      'Esta tabela de peças ainda não existe no Supabase. Abra o SQL Editor do projeto e rode o ' +
      `arquivo ${SQL_DA_TABELA[tabela]} do repositório.`
    );
  }
  if (e.status === 409) return 'Já existe outra peça com esse código.';
  return e.message;
}

/* ---------------------------------------------------------------------
 * Carrega as peças só quando a aba é aberta pela primeira vez, e mantém
 * a lista em memória enquanto a tela de Cadastros estiver aberta.
 * ------------------------------------------------------------------ */
export function usePecas(ativo: boolean, tabela: TabelaPecas) {
  const [pecas, setPecas] = useState<Peca[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const armazem = await armazemPecas(tabela);
      setPecas(await armazem.listar());
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível carregar as peças.', tabela));
    } finally {
      setCarregando(false);
    }
  }, [tabela]);

  useEffect(() => {
    if (ativo && pecas === null && !carregando && !erro) void recarregar();
  }, [ativo, pecas, carregando, erro, recarregar]);

  return { tabela, pecas, setPecas, erro, carregando, recarregar };
}

type EstadoPecas = ReturnType<typeof usePecas>;

const VAZIO = { codigo: '', descricao: '', posicao: '', categoria: '', linha: '', maquina_id: '' };

export function CadastroPecas({
  estado,
  ehAdmin,
  titulo,
  subtitulo,
}: {
  estado: EstadoPecas;
  ehAdmin: boolean;
  titulo: string;
  subtitulo: string;
}) {
  const { tabela, pecas, setPecas, erro, carregando, recarregar } = estado;
  const { lookups } = useLookups();
  const avisar = useAviso();

  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [maquina, setMaquina] = useState('');
  const [pagina, setPagina] = useState(1);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Peca | null>(null);
  const [valores, setValores] = useState<Record<string, string>>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Peca | null>(null);

  const lista = pecas ?? [];

  const nomeMaquina = useMemo(() => {
    const mapa = new Map(lookups.maquinas.map((m) => [m.id, `${m.codigo} · ${m.nome}`]));
    return (id: number | null) => (id ? (mapa.get(id) ?? '—') : '—');
  }, [lookups.maquinas]);

  const categorias = useMemo(
    () => [...new Set(lista.map((p) => p.categoria).filter(Boolean) as string[])].sort(),
    [lista],
  );
  const linhas = useMemo(
    () =>
      [
        ...new Set([
          ...(lista.map((p) => p.linha).filter(Boolean) as string[]),
          ...lookups.setores.map((s) => s.nome),
        ]),
      ].sort(),
    [lista, lookups.setores],
  );

  const filtradas = useMemo(() => {
    const termo = SEM_ACENTO(busca.trim());
    return lista
      .filter((p) => !categoria || p.categoria === categoria)
      .filter((p) =>
        !maquina ? true : maquina === 'sem' ? !p.maquina_id : p.maquina_id === Number(maquina),
      )
      .filter(
        (p) =>
          !termo ||
          SEM_ACENTO(
            [p.codigo, p.descricao, p.posicao, p.linha, nomeMaquina(p.maquina_id)].join(' '),
          ).includes(termo),
      )
      .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
  }, [lista, busca, categoria, maquina, nomeMaquina]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  // Filtro novo volta para a primeira página.
  useEffect(() => setPagina(1), [busca, categoria, maquina]);

  function abrirNovo() {
    setEditando(null);
    setValores(VAZIO);
    setErroForm(null);
    setFormAberto(true);
  }

  function abrirEdicao(p: Peca) {
    setEditando(p);
    setValores({
      codigo: p.codigo,
      descricao: p.descricao,
      posicao: p.posicao ?? '',
      categoria: p.categoria ?? '',
      linha: p.linha ?? '',
      maquina_id: p.maquina_id ? String(p.maquina_id) : '',
    });
    setErroForm(null);
    setFormAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const dados = limparPeca(valores);
    if (!dados.codigo) return setErroForm('Preencha o campo "Código".');
    if (!dados.descricao) return setErroForm('Preencha o campo "Descrição".');
    const repetida = lista.find((p) => p.codigo === dados.codigo && p.id !== editando?.id);
    if (repetida) return setErroForm(`O código ${dados.codigo} já é da peça "${repetida.descricao}".`);

    setSalvando(true);
    setErroForm(null);
    try {
      const armazem = await armazemPecas(tabela);
      if (editando) {
        const salva = await armazem.atualizar(editando.id, dados);
        setPecas((atual) => (atual ?? []).map((p) => (p.id === salva.id ? salva : p)));
        avisar('Alterações salvas.');
      } else {
        const nova = await armazem.inserir({ ...dados, ativo: 1 });
        setPecas((atual) => [...(atual ?? []), nova]);
        avisar('Peça cadastrada com sucesso.');
      }
      setFormAberto(false);
    } catch (e) {
      setErroForm(mensagemErro(e, 'Não foi possível salvar.', tabela));
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(p: Peca) {
    try {
      const armazem = await armazemPecas(tabela);
      const salva = await armazem.atualizar(p.id, { ativo: p.ativo === 1 ? 0 : 1 });
      setPecas((atual) => (atual ?? []).map((x) => (x.id === salva.id ? salva : x)));
      avisar(salva.ativo === 1 ? 'Peça reativada.' : 'Peça inativada.');
    } catch (e) {
      avisar(mensagemErro(e, 'Falha ao alterar a situação.', tabela), 'erro');
    }
  }

  async function excluir() {
    if (!paraExcluir) return;
    try {
      const armazem = await armazemPecas(tabela);
      await armazem.excluir(paraExcluir.id);
      setPecas((atual) => (atual ?? []).filter((p) => p.id !== paraExcluir.id));
      avisar('Peça excluída.');
      setParaExcluir(null);
    } catch (e) {
      avisar(mensagemErro(e, 'Falha ao excluir.', tabela), 'erro');
    }
  }

  const definir = (campo: string, valor: string) => setValores((v) => ({ ...v, [campo]: valor }));

  return (
    <>
      <Cartao
        titulo={titulo}
        subtitulo={subtitulo}
        acao={
          ehAdmin ? (
            <Botao icone={<Plus className="size-4" aria-hidden />} onClick={abrirNovo}>
              Nova peça
            </Botao>
          ) : null
        }
        semPadding
      >
        {/* Filtros */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center dark:border-slate-800">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Entrada
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, descrição, posição, linha ou máquina"
              aria-label="Buscar peças"
              className="pl-9"
            />
          </div>
          <Selecao
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            aria-label="Filtrar por categoria"
            className="lg:w-48"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Selecao>
          <Selecao
            value={maquina}
            onChange={(e) => setMaquina(e.target.value)}
            aria-label="Filtrar por máquina"
            className="lg:w-56"
          >
            <option value="">Todas as máquinas</option>
            <option value="sem">Sem máquina definida</option>
            {lookups.maquinas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codigo} · {m.nome}
              </option>
            ))}
          </Selecao>
        </div>

        {erro ? (
          <div className="p-5">
            <Alerta titulo="Erro ao carregar as peças">{erro}</Alerta>
            <div className="mt-3">
              <Botao variante="secundario" tamanho="pequeno" onClick={() => void recarregar()}>
                Tentar de novo
              </Botao>
            </div>
          </div>
        ) : carregando || pecas === null ? (
          <Carregando texto="Carregando peças..." />
        ) : lista.length === 0 ? (
          <EstadoVazio
            icone={<Package className="size-6" aria-hidden />}
            titulo="Nenhuma peça cadastrada"
            descricao="Cadastre a primeira peça ou importe a planilha de estoque."
            acao={
              ehAdmin ? (
                <Botao icone={<Plus className="size-4" aria-hidden />} onClick={abrirNovo}>
                  Nova peça
                </Botao>
              ) : null
            }
          />
        ) : filtradas.length === 0 ? (
          <EstadoVazio
            icone={<Search className="size-6" aria-hidden />}
            titulo="Nenhuma peça encontrada"
            descricao="Tente outro termo de busca ou limpe os filtros."
          />
        ) : (
          <>
            <p className="px-5 pt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
              {filtradas.length.toLocaleString('pt-BR')} de {lista.length.toLocaleString('pt-BR')}{' '}
              peças
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <caption className="sr-only">Lista de peças</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-bold tracking-wide text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
                    <th scope="col" className="px-5 py-3">Código</th>
                    <th scope="col" className="px-5 py-3">Descrição</th>
                    <th scope="col" className="px-5 py-3">Posição</th>
                    <th scope="col" className="px-5 py-3">Categoria</th>
                    <th scope="col" className="px-5 py-3">Linha</th>
                    <th scope="col" className="px-5 py-3">Máquina</th>
                    <th scope="col" className="px-5 py-3">Situação</th>
                    {ehAdmin && <th scope="col" className="px-5 py-3 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visiveis.map((p) => (
                    <tr
                      key={p.id}
                      className={cx(
                        'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40',
                        p.ativo === 0 && 'opacity-60',
                      )}
                    >
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs font-bold text-marca-600 dark:text-marca-400">
                          {p.codigo}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-200">
                        {p.descricao}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {p.posicao || '—'}
                      </td>
                      <td className="px-5 py-3">
                        {p.categoria ? <Etiqueta tom="marca">{p.categoria}</Etiqueta> : '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{p.linha || '—'}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-200">
                        {nomeMaquina(p.maquina_id)}
                      </td>
                      <td className="px-5 py-3">
                        {ehAdmin ? (
                          <button
                            type="button"
                            onClick={() => alternarAtivo(p)}
                            title={p.ativo === 1 ? 'Clique para inativar' : 'Clique para reativar'}
                            className="cursor-pointer"
                          >
                            <Etiqueta tom={p.ativo === 1 ? 'sucesso' : 'neutro'}>
                              {p.ativo === 1 ? 'Ativo' : 'Inativo'}
                            </Etiqueta>
                          </button>
                        ) : (
                          <Etiqueta tom={p.ativo === 1 ? 'sucesso' : 'neutro'}>
                            {p.ativo === 1 ? 'Ativo' : 'Inativo'}
                          </Etiqueta>
                        )}
                      </td>
                      {ehAdmin && (
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Botao
                              tamanho="pequeno"
                              variante="fantasma"
                              onClick={() => abrirEdicao(p)}
                              aria-label="Editar peça"
                              title="Editar"
                            >
                              <SquarePen className="size-4" aria-hidden />
                            </Botao>
                            <Botao
                              tamanho="pequeno"
                              variante="fantasma"
                              onClick={() => setParaExcluir(p)}
                              aria-label="Excluir peça"
                              title="Excluir"
                              className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Botao>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {paginas > 1 && (
              <nav
                aria-label="Paginação das peças"
                className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800"
              >
                <Botao
                  variante="secundario"
                  tamanho="pequeno"
                  disabled={paginaAtual <= 1}
                  onClick={() => setPagina(paginaAtual - 1)}
                  icone={<ChevronLeft className="size-4" aria-hidden />}
                >
                  Anterior
                </Botao>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Página {paginaAtual} de {paginas}
                </span>
                <Botao
                  variante="secundario"
                  tamanho="pequeno"
                  disabled={paginaAtual >= paginas}
                  onClick={() => setPagina(paginaAtual + 1)}
                >
                  Próxima <ChevronRight className="size-4" aria-hidden />
                </Botao>
              </nav>
            )}
          </>
        )}
      </Cartao>

      {/* ------------------------- Formulário ------------------------- */}
      <Modal
        aberto={formAberto}
        aoFechar={() => setFormAberto(false)}
        titulo={editando ? 'Editar peça' : 'Nova peça'}
        largura="max-w-xl"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setFormAberto(false)} type="button">
              Cancelar
            </Botao>
            <Botao
              type="submit"
              form={`form-peca-${tabela}`}
              carregando={salvando}
              icone={<Save className="size-4" aria-hidden />}
            >
              Salvar
            </Botao>
          </>
        }
      >
        <form id={`form-peca-${tabela}`} onSubmit={salvar} className="space-y-4" noValidate>
          {erroForm && <Alerta>{erroForm}</Alerta>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Código" obrigatorio dica="Código do item no estoque.">
              {(id) => (
                <Entrada
                  id={id}
                  value={valores.codigo}
                  placeholder="80002541"
                  onChange={(e) => definir('codigo', e.target.value)}
                />
              )}
            </Campo>
            <Campo rotulo="Posição" dica="Endereço no almoxarifado.">
              {(id) => (
                <Entrada
                  id={id}
                  value={valores.posicao}
                  placeholder="C-7-2-7"
                  onChange={(e) => definir('posicao', e.target.value)}
                />
              )}
            </Campo>
          </div>

          <Campo rotulo="Descrição da peça" obrigatorio>
            {(id) => (
              <Entrada
                id={id}
                value={valores.descricao}
                placeholder="SENSOR HTB18-P4A2BB"
                onChange={(e) => definir('descricao', e.target.value)}
              />
            )}
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Categoria">
              {(id) => (
                <>
                  <Entrada
                    id={id}
                    list={`lista-categorias-pecas-${tabela}`}
                    value={valores.categoria}
                    placeholder="ELETRICA"
                    onChange={(e) => definir('categoria', e.target.value)}
                  />
                  <datalist id={`lista-categorias-pecas-${tabela}`}>
                    {categorias.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
            </Campo>
            <Campo rotulo="Linha" dica="Linha de produção onde a peça é usada.">
              {(id) => (
                <>
                  <Entrada
                    id={id}
                    list={`lista-linhas-pecas-${tabela}`}
                    value={valores.linha}
                    onChange={(e) => definir('linha', e.target.value)}
                  />
                  <datalist id={`lista-linhas-pecas-${tabela}`}>
                    {linhas.map((l) => (
                      <option key={l} value={l} />
                    ))}
                  </datalist>
                </>
              )}
            </Campo>
          </div>

          <Campo rotulo="Máquina" dica="Máquina que usa esta peça (cadastrada na aba Máquinas).">
            {(id) => (
              <Selecao
                id={id}
                value={valores.maquina_id}
                onChange={(e) => definir('maquina_id', e.target.value)}
              >
                <option value="">Não informado</option>
                {lookups.maquinas
                  .filter((m) => m.ativo === 1 || String(m.id) === valores.maquina_id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codigo} · {m.nome}
                    </option>
                  ))}
              </Selecao>
            )}
          </Campo>
        </form>
      </Modal>

      {/* ------------------------- Exclusão ------------------------- */}
      <Modal
        aberto={Boolean(paraExcluir)}
        aoFechar={() => setParaExcluir(null)}
        titulo="Excluir peça"
        largura="max-w-lg"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setParaExcluir(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={excluir} icone={<Trash2 className="size-4" aria-hidden />}>
              Excluir
            </Botao>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Confirmar a exclusão da peça <strong>{paraExcluir?.codigo}</strong> —{' '}
          {paraExcluir?.descricao}?
        </p>
        <p className="mt-3 rounded-xl bg-sky-50 p-3.5 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
          Se a peça só saiu de linha, prefira <strong>inativar</strong> clicando na etiqueta
          "Ativo" — ela continua na lista para consulta.
        </p>
      </Modal>
    </>
  );
}
