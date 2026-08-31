import { useMemo, useState, type ReactNode } from 'react';
import {
  Building2,
  Clock,
  Cog,
  ListTree,
  Plus,
  Save,
  SquarePen,
  Trash2,
  UserRound,
} from 'lucide-react';

import { TituloPagina } from '../components/Layout';
import { GerenciarDados } from '../components/GerenciarDados';
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
} from '../components/ui';
import { api, ErroApi, MODO_NAVEGADOR } from '../lib/api';
import { useLookups } from '../lib/dados';
import { TOM_CRITICIDADE } from '../lib/visual';

/* ---------------------------------------------------------------------
 * Descricao dos campos de cada cadastro. A tela e montada a partir daqui,
 * entao acrescentar um campo novo e questao de editar esta configuracao.
 * ------------------------------------------------------------------ */
type CampoForm = {
  nome: string;
  rotulo: string;
  tipo: 'texto' | 'select' | 'hora';
  obrigatorio?: boolean;
  dica?: string;
  placeholder?: string;
  opcoes?: { valor: string; rotulo: string }[];
};

type Aba = {
  chave: string;
  rotulo: string;
  singular: string;
  novo: string;
  vazioTitulo: string;
  icone: ReactNode;
  descricao: string;
  campos: CampoForm[];
  colunas: { titulo: string; render: (item: any) => ReactNode; alinhar?: 'direita' }[];
  inicial: Record<string, string | undefined>;
};

const CATEGORIAS = [
  'Mecanica',
  'Eletrica',
  'Hidraulica',
  'Pneumatica',
  'Automacao',
  'Operacional',
  'Qualidade',
  'Setup',
  'Outros',
];

export function Cadastros() {
  const { lookups, carregando, erro, recarregar } = useLookups();
  const avisar = useAviso();

  const [abaAtiva, setAbaAtiva] = useState('maquinas');
  const [editando, setEditando] = useState<Record<string, any> | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<Record<string, any> | null>(null);
  const [valores, setValores] = useState<Record<string, string | undefined>>({});
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const nomeSetor = (id: number | null) =>
    lookups.setores.find((s) => s.id === id)?.nome ?? '—';

  const ABAS = useMemo<Aba[]>(
    () => [
      {
        chave: 'maquinas',
        rotulo: 'Máquinas',
        singular: 'máquina',
        novo: 'Nova máquina',
        vazioTitulo: 'Nenhuma máquina cadastrada',
        icone: <Cog className="size-4" aria-hidden />,
        descricao: 'Equipamentos que aparecem nos chamados e nos indicadores.',
        inicial: { codigo: '', nome: '', setor_id: '', criticidade: 'Media' },
        campos: [
          {
            nome: 'codigo',
            rotulo: 'Código',
            tipo: 'texto',
            obrigatorio: true,
            placeholder: 'EXT-01',
            dica: 'Identificação curta usada no chão de fábrica.',
          },
          { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: 'Extrusora 90mm' },
          {
            nome: 'setor_id',
            rotulo: 'Setor',
            tipo: 'select',
            opcoes: lookups.setores.map((s) => ({ valor: String(s.id), rotulo: s.nome })),
          },
          {
            nome: 'criticidade',
            rotulo: 'Criticidade',
            tipo: 'select',
            dica: 'Usada para priorizar chamados automaticamente.',
            opcoes: [
              { valor: 'Baixa', rotulo: 'Baixa' },
              { valor: 'Media', rotulo: 'Média' },
              { valor: 'Alta', rotulo: 'Alta' },
            ],
          },
        ],
        colunas: [
          {
            titulo: 'Código',
            render: (m) => (
              <span className="font-mono text-xs font-bold text-marca-600 dark:text-marca-400">
                {m.codigo}
              </span>
            ),
          },
          {
            titulo: 'Máquina',
            render: (m) => <span className="font-semibold">{m.nome}</span>,
          },
          { titulo: 'Setor', render: (m) => nomeSetor(m.setor_id) },
          {
            titulo: 'Criticidade',
            render: (m) => <Etiqueta tom={TOM_CRITICIDADE[m.criticidade as 'Alta']}>{m.criticidade}</Etiqueta>,
          },
        ],
      },
      {
        chave: 'setores',
        rotulo: 'Setores',
        singular: 'setor',
        novo: 'Novo setor',
        vazioTitulo: 'Nenhum setor cadastrado',
        icone: <Building2 className="size-4" aria-hidden />,
        descricao: 'Áreas da fábrica usadas para agrupar máquinas e filtrar relatórios.',
        inicial: { nome: '' },
        campos: [
          { nome: 'nome', rotulo: 'Nome do setor', tipo: 'texto', obrigatorio: true, placeholder: 'Injeção' },
        ],
        colunas: [
          { titulo: 'Setor', render: (s) => <span className="font-semibold">{s.nome}</span> },
          {
            titulo: 'Máquinas',
            render: (s) => lookups.maquinas.filter((m) => m.setor_id === s.id).length,
            alinhar: 'direita',
          },
        ],
      },
      {
        chave: 'motivos',
        rotulo: 'Motivos',
        singular: 'motivo',
        novo: 'Novo motivo',
        vazioTitulo: 'Nenhum motivo cadastrado',
        icone: <ListTree className="size-4" aria-hidden />,
        descricao: 'Causas de parada. São a base do gráfico de Pareto do painel.',
        inicial: { nome: '', categoria: 'Mecanica' },
        campos: [
          {
            nome: 'nome',
            rotulo: 'Motivo',
            tipo: 'texto',
            obrigatorio: true,
            placeholder: 'Rolamento danificado',
          },
          {
            nome: 'categoria',
            rotulo: 'Categoria',
            tipo: 'select',
            opcoes: CATEGORIAS.map((c) => ({ valor: c, rotulo: c })),
          },
        ],
        colunas: [
          { titulo: 'Motivo', render: (m) => <span className="font-semibold">{m.nome}</span> },
          { titulo: 'Categoria', render: (m) => <Etiqueta tom="marca">{m.categoria}</Etiqueta> },
        ],
      },
      {
        chave: 'tecnicos',
        rotulo: 'Técnicos',
        singular: 'técnico',
        novo: 'Novo técnico',
        vazioTitulo: 'Nenhum técnico cadastrado',
        icone: <UserRound className="size-4" aria-hidden />,
        descricao: 'Equipe que atende os chamados. Aparece nos relatórios de TA.',
        inicial: { nome: '', matricula: '', especialidade: '' },
        campos: [
          { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: 'Carlos Menezes' },
          { nome: 'matricula', rotulo: 'Matrícula', tipo: 'texto', placeholder: '10234' },
          {
            nome: 'especialidade',
            rotulo: 'Especialidade',
            tipo: 'texto',
            placeholder: 'Mecânica, Elétrica...',
          },
        ],
        colunas: [
          { titulo: 'Nome', render: (t) => <span className="font-semibold">{t.nome}</span> },
          { titulo: 'Matrícula', render: (t) => t.matricula || '—' },
          { titulo: 'Especialidade', render: (t) => t.especialidade || '—' },
        ],
      },
      {
        chave: 'turnos',
        rotulo: 'Turnos',
        singular: 'turno',
        novo: 'Novo turno',
        vazioTitulo: 'Nenhum turno cadastrado',
        icone: <Clock className="size-4" aria-hidden />,
        descricao:
          'Faixas de horário. O turno de cada chamado é identificado pelo horário de abertura.',
        inicial: { nome: '', hora_inicio: '06:00', hora_fim: '14:00' },
        campos: [
          { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: '1º Turno' },
          { nome: 'hora_inicio', rotulo: 'Início', tipo: 'hora', obrigatorio: true },
          {
            nome: 'hora_fim',
            rotulo: 'Fim',
            tipo: 'hora',
            obrigatorio: true,
            dica: 'Pode virar o dia (ex.: 22:00 às 06:00).',
          },
        ],
        colunas: [
          { titulo: 'Turno', render: (t) => <span className="font-semibold">{t.nome}</span> },
          {
            titulo: 'Horário',
            render: (t) => (
              <span className="tabular-nums">
                {t.hora_inicio} às {t.hora_fim}
              </span>
            ),
          },
        ],
      },
    ],
    [lookups],
  );

  const aba = ABAS.find((a) => a.chave === abaAtiva)!;
  const itens = (lookups as any)[aba.chave] as Record<string, any>[];

  function abrirNovo() {
    setEditando(null);
    setValores({ ...aba.inicial });
    setErroForm(null);
    setFormAberto(true);
  }

  function abrirEdicao(item: Record<string, any>) {
    setEditando(item);
    const preenchido: Record<string, string> = {};
    for (const campo of aba.campos) {
      const v = item[campo.nome];
      preenchido[campo.nome] = v === null || v === undefined ? '' : String(v);
    }
    setValores(preenchido);
    setErroForm(null);
    setFormAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const faltando = aba.campos.find((c) => c.obrigatorio && !valores[c.nome]?.trim());
    if (faltando) {
      setErroForm(`Preencha o campo "${faltando.rotulo}".`);
      return;
    }

    const corpo: Record<string, unknown> = {};
    for (const campo of aba.campos) {
      const bruto = valores[campo.nome];
      corpo[campo.nome] =
        campo.nome === 'setor_id' ? (bruto ? Number(bruto) : null) : bruto?.trim() || null;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando) {
        await api.put(`/lookups/${aba.chave}/${editando.id}`, corpo);
        avisar('Alterações salvas.');
      } else {
        await api.post(`/lookups/${aba.chave}`, corpo);
        avisar('Cadastro criado com sucesso.');
      }
      await recarregar();
      setFormAberto(false);
    } catch (e) {
      setErroForm(e instanceof ErroApi ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(item: Record<string, any>) {
    try {
      await api.put(`/lookups/${aba.chave}/${item.id}`, { ativo: item.ativo === 1 ? 0 : 1 });
      await recarregar();
      avisar(item.ativo === 1 ? 'Registro inativado.' : 'Registro reativado.');
    } catch (e) {
      avisar(e instanceof ErroApi ? e.message : 'Falha ao alterar a situação.', 'erro');
    }
  }

  async function excluir() {
    if (!paraExcluir) return;
    try {
      const r = await api.del<{ mensagem: string; inativado: boolean }>(
        `/lookups/${aba.chave}/${paraExcluir.id}`,
      );
      avisar(r.mensagem, r.inativado ? 'info' : 'sucesso');
      setParaExcluir(null);
      await recarregar();
    } catch (e) {
      avisar(e instanceof ErroApi ? e.message : 'Falha ao excluir.', 'erro');
    }
  }

  return (
    <>
      <TituloPagina
        titulo="Cadastros"
        descricao="Tudo que alimenta os formulários de ocorrência: máquinas, setores, motivos de parada, equipe e turnos."
        acoes={
          <Botao icone={<Plus className="size-4" aria-hidden />} onClick={abrirNovo}>
            {aba.novo}
          </Botao>
        }
      />

      {/* Abas */}
      <div
        className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        role="tablist"
        aria-label="Tipos de cadastro"
      >
        {ABAS.map((a) => (
          <button
            key={a.chave}
            role="tab"
            aria-selected={a.chave === abaAtiva}
            onClick={() => setAbaAtiva(a.chave)}
            className={cx(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
              a.chave === abaAtiva
                ? 'bg-marca-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            {a.icone}
            {a.rotulo}
            <span
              className={cx(
                'rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums',
                a.chave === abaAtiva
                  ? 'bg-white/20'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
              )}
            >
              {((lookups as any)[a.chave] as unknown[]).length}
            </span>
          </button>
        ))}
      </div>

      {erro && (
        <div className="mb-6">
          <Alerta titulo="Erro ao carregar os cadastros">{erro}</Alerta>
        </div>
      )}

      <Cartao titulo={aba.rotulo} subtitulo={aba.descricao} semPadding>
        {carregando ? (
          <Carregando />
        ) : itens.length === 0 ? (
          <EstadoVazio
            icone={aba.icone}
            titulo={aba.vazioTitulo}
            descricao="Cadastre o primeiro registro para começar a usar esta lista nos formulários."
            acao={
              <Botao icone={<Plus className="size-4" aria-hidden />} onClick={abrirNovo}>
                {aba.novo}
              </Botao>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Lista de {aba.rotulo.toLowerCase()}</caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-bold tracking-wide text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
                  {aba.colunas.map((c) => (
                    <th
                      key={c.titulo}
                      scope="col"
                      className={cx('px-5 py-3', c.alinhar === 'direita' && 'text-right')}
                    >
                      {c.titulo}
                    </th>
                  ))}
                  <th scope="col" className="px-5 py-3">Situação</th>
                  <th scope="col" className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {itens.map((item) => (
                  <tr
                    key={item.id}
                    className={cx(
                      'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40',
                      item.ativo === 0 && 'opacity-60',
                    )}
                  >
                    {aba.colunas.map((c) => (
                      <td
                        key={c.titulo}
                        className={cx(
                          'px-5 py-3 text-slate-700 dark:text-slate-200',
                          c.alinhar === 'direita' && 'text-right tabular-nums',
                        )}
                      >
                        {c.render(item)}
                      </td>
                    ))}
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => alternarAtivo(item)}
                        title={item.ativo === 1 ? 'Clique para inativar' : 'Clique para reativar'}
                        className="cursor-pointer"
                      >
                        <Etiqueta tom={item.ativo === 1 ? 'sucesso' : 'neutro'}>
                          {item.ativo === 1 ? 'Ativo' : 'Inativo'}
                        </Etiqueta>
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Botao
                          tamanho="pequeno"
                          variante="fantasma"
                          onClick={() => abrirEdicao(item)}
                          aria-label={`Editar ${aba.singular}`}
                          title="Editar"
                        >
                          <SquarePen className="size-4" aria-hidden />
                        </Botao>
                        <Botao
                          tamanho="pequeno"
                          variante="fantasma"
                          onClick={() => setParaExcluir(item)}
                          aria-label={`Excluir ${aba.singular}`}
                          title="Excluir"
                          className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Botao>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {MODO_NAVEGADOR && <GerenciarDados aoMudar={recarregar} />}

      {/* ------------------------- Formulário ------------------------- */}
      <Modal
        aberto={formAberto}
        aoFechar={() => setFormAberto(false)}
        titulo={editando ? `Editar ${aba.singular}` : aba.novo}
        largura="max-w-xl"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setFormAberto(false)} type="button">
              Cancelar
            </Botao>
            <Botao
              type="submit"
              form="form-cadastro"
              carregando={salvando}
              icone={<Save className="size-4" aria-hidden />}
            >
              Salvar
            </Botao>
          </>
        }
      >
        <form id="form-cadastro" onSubmit={salvar} className="space-y-4" noValidate>
          {erroForm && <Alerta>{erroForm}</Alerta>}

          {aba.campos.map((campo) => (
            <Campo
              key={campo.nome}
              rotulo={campo.rotulo}
              obrigatorio={campo.obrigatorio}
              dica={campo.dica}
            >
              {(id) =>
                campo.tipo === 'select' ? (
                  <Selecao
                    id={id}
                    value={valores[campo.nome] ?? ''}
                    onChange={(e) => setValores((v) => ({ ...v, [campo.nome]: e.target.value }))}
                  >
                    {!campo.obrigatorio && <option value="">Não informado</option>}
                    {campo.opcoes?.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </Selecao>
                ) : (
                  <Entrada
                    id={id}
                    type={campo.tipo === 'hora' ? 'time' : 'text'}
                    value={valores[campo.nome] ?? ''}
                    placeholder={campo.placeholder}
                    onChange={(e) => setValores((v) => ({ ...v, [campo.nome]: e.target.value }))}
                  />
                )
              }
            </Campo>
          ))}
        </form>
      </Modal>

      {/* ------------------------- Exclusão ------------------------- */}
      <Modal
        aberto={Boolean(paraExcluir)}
        aoFechar={() => setParaExcluir(null)}
        titulo={`Excluir ${aba.singular}`}
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
          Confirmar a exclusão de <strong>{paraExcluir?.nome || paraExcluir?.codigo}</strong>?
        </p>
        <p className="mt-3 rounded-xl bg-sky-50 p-3.5 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
          Se este registro já aparecer em alguma ocorrência, ele será apenas <strong>inativado</strong>{' '}
          — assim o histórico e os indicadores continuam corretos.
        </p>
      </Modal>
    </>
  );
}
