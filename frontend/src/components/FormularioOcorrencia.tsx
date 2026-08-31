import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import {
  Alerta,
  AreaTexto,
  Botao,
  Campo,
  cx,
  Entrada,
  Modal,
  Selecao,
  useAviso,
} from './ui';
import { api, ErroApi, type Ocorrencia, type Prioridade, type TipoManutencao } from '../lib/api';
import { somenteAtivos, useLookups } from '../lib/dados';
import { agoraInput, paraInput } from '../lib/formato';

const TIPOS: TipoManutencao[] = ['Corretiva', 'Preventiva', 'Preditiva', 'Melhoria'];
const PRIORIDADES: Prioridade[] = ['Baixa', 'Media', 'Alta', 'Critica'];

const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  Baixa: 'Baixa',
  Media: 'Média',
  Alta: 'Alta',
  Critica: 'Crítica',
};

/** Botoes lado a lado no lugar de um <select> - menos cliques e mais claro. */
function Segmentado<T extends string>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
  rotularOpcao,
  corAtiva,
}: {
  rotulo: string;
  opcoes: readonly T[];
  valor: T;
  aoMudar: (v: T) => void;
  rotularOpcao?: (v: T) => string;
  corAtiva?: (v: T) => string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {rotulo}
      </legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((op) => {
          const ativo = op === valor;
          return (
            <button
              key={op}
              type="button"
              aria-pressed={ativo}
              onClick={() => aoMudar(op)}
              className={cx(
                'rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors',
                ativo
                  ? corAtiva?.(op) || 'border-marca-600 bg-marca-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              )}
            >
              {rotularOpcao ? rotularOpcao(op) : op}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

type Formulario = {
  maquina_id: string;
  motivo_id: string;
  tecnico_id: string;
  tipo: TipoManutencao;
  prioridade: Prioridade;
  descricao: string;
  solucao: string;
  parou_producao: boolean;
  aberto_em: string;
  atendido_em: string;
  fim_em: string;
};

const vazio = (): Formulario => ({
  maquina_id: '',
  motivo_id: '',
  tecnico_id: '',
  tipo: 'Corretiva',
  prioridade: 'Media',
  descricao: '',
  solucao: '',
  parou_producao: true,
  aberto_em: agoraInput(),
  atendido_em: '',
  fim_em: '',
});

const doRegistro = (o: Ocorrencia): Formulario => ({
  maquina_id: String(o.maquina_id),
  motivo_id: o.motivo_id ? String(o.motivo_id) : '',
  tecnico_id: o.tecnico_id ? String(o.tecnico_id) : '',
  tipo: o.tipo,
  prioridade: o.prioridade,
  descricao: o.descricao,
  solucao: o.solucao ?? '',
  parou_producao: o.parou_producao === 1,
  aberto_em: paraInput(o.aberto_em),
  atendido_em: paraInput(o.atendido_em),
  fim_em: paraInput(o.fim_em),
});

export function FormularioOcorrencia({
  aberto,
  aoFechar,
  aoSalvar,
  registro,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: () => void;
  /** Quando vem preenchido, o formulario edita em vez de criar. */
  registro?: Ocorrencia | null;
}) {
  const { lookups } = useLookups();
  const avisar = useAviso();

  const [form, setForm] = useState<Formulario>(vazio);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setForm(registro ? doRegistro(registro) : vazio());
    setErros({});
  }, [aberto, registro]);

  const definir = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const maquinas = somenteAtivos(lookups.maquinas);
  const setorDaMaquina = (id: number | null) =>
    lookups.setores.find((s) => s.id === id)?.nome ?? 'Sem setor';

  // Agrupa as maquinas por setor no <select>, fica muito mais facil de achar
  const porSetor = maquinas.reduce<Record<string, typeof maquinas>>((acc, m) => {
    const chave = setorDaMaquina(m.setor_id);
    (acc[chave] ||= []).push(m);
    return acc;
  }, {});

  function validar(): boolean {
    const novos: Record<string, string> = {};
    if (!form.maquina_id) novos.maquina_id = 'Escolha a máquina que parou.';
    if (form.descricao.trim().length < 3)
      novos.descricao = 'Escreva pelo menos algumas palavras sobre o que aconteceu.';
    if (!form.aberto_em) novos.aberto_em = 'Informe quando o chamado foi aberto.';
    if (form.atendido_em && form.aberto_em && form.atendido_em < form.aberto_em)
      novos.atendido_em = 'O atendimento não pode começar antes da abertura.';
    if (form.fim_em && form.atendido_em && form.fim_em < form.atendido_em)
      novos.fim_em = 'O fim não pode ser anterior ao início do atendimento.';
    if (form.fim_em && !form.atendido_em)
      novos.atendido_em = 'Informe quando o atendimento começou para poder fechar o chamado.';
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!validar()) return;

    setSalvando(true);
    const corpo = {
      maquina_id: Number(form.maquina_id),
      motivo_id: form.motivo_id ? Number(form.motivo_id) : null,
      tecnico_id: form.tecnico_id ? Number(form.tecnico_id) : null,
      tipo: form.tipo,
      prioridade: form.prioridade,
      descricao: form.descricao.trim(),
      solucao: form.solucao.trim() || null,
      parou_producao: form.parou_producao ? 1 : 0,
      aberto_em: form.aberto_em,
      atendido_em: form.atendido_em || null,
      fim_em: form.fim_em || null,
    };

    try {
      if (registro) {
        await api.put(`/ocorrencias/${registro.id}`, corpo);
        avisar('Ocorrência atualizada.');
      } else {
        await api.post('/ocorrencias', corpo);
        avisar('Ocorrência registrada.');
      }
      aoSalvar();
      aoFechar();
    } catch (e) {
      avisar(e instanceof ErroApi ? e.message : 'Não foi possível salvar.', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={registro ? `Editar ocorrência #${registro.id}` : 'Nova ocorrência'}
      descricao="Os campos marcados com * são obrigatórios. Os horários podem ser preenchidos depois."
      largura="max-w-3xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} type="button">
            Cancelar
          </Botao>
          <Botao
            type="submit"
            form="form-ocorrencia"
            carregando={salvando}
            icone={<Save className="size-4" aria-hidden />}
          >
            {registro ? 'Salvar alterações' : 'Registrar ocorrência'}
          </Botao>
        </>
      }
    >
      <form id="form-ocorrencia" onSubmit={enviar} className="space-y-6" noValidate>
        {maquinas.length === 0 && (
          <Alerta tom="alerta" titulo="Nenhuma máquina cadastrada">
            Não dá para registrar uma parada sem saber de qual máquina ela é. Vá em{' '}
            <strong>Cadastros → Setores</strong>, crie os setores da fábrica, depois em{' '}
            <strong>Cadastros → Máquinas</strong> cadastre os equipamentos. Aí volte aqui.
          </Alerta>
        )}

        {/* ---------------- O que aconteceu ---------------- */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            O que aconteceu
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Máquina" obrigatorio erro={erros.maquina_id}>
              {(id) => (
                <Selecao
                  id={id}
                  value={form.maquina_id}
                  onChange={(e) => definir('maquina_id', e.target.value)}
                  aria-invalid={Boolean(erros.maquina_id)}
                >
                  <option value="">Selecione...</option>
                  {Object.entries(porSetor).map(([setor, lista]) => (
                    <optgroup key={setor} label={setor}>
                      {lista.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.codigo} — {m.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Selecao>
              )}
            </Campo>

            <Campo rotulo="Motivo da parada" dica="Opcional, mas ajuda muito nos relatórios.">
              {(id) => (
                <Selecao
                  id={id}
                  value={form.motivo_id}
                  onChange={(e) => definir('motivo_id', e.target.value)}
                >
                  <option value="">Não informado</option>
                  {somenteAtivos(lookups.motivos).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.categoria})
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </div>

          <Segmentado
            rotulo="Tipo de manutenção"
            opcoes={TIPOS}
            valor={form.tipo}
            aoMudar={(v) => definir('tipo', v)}
          />

          <Segmentado
            rotulo="Prioridade"
            opcoes={PRIORIDADES}
            valor={form.prioridade}
            aoMudar={(v) => definir('prioridade', v)}
            rotularOpcao={(v) => ROTULO_PRIORIDADE[v]}
            corAtiva={(v) =>
              v === 'Critica'
                ? 'border-rose-600 bg-rose-600 text-white'
                : v === 'Alta'
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : v === 'Media'
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-600 bg-slate-600 text-white'
            }
          />

          <Campo rotulo="Descrição" obrigatorio erro={erros.descricao}>
            {(id) => (
              <AreaTexto
                id={id}
                value={form.descricao}
                onChange={(e) => definir('descricao', e.target.value)}
                placeholder="Ex.: máquina parou no meio do ciclo, com ruído no motor principal"
                aria-invalid={Boolean(erros.descricao)}
              />
            )}
          </Campo>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60">
            <input
              type="checkbox"
              checked={form.parou_producao}
              onChange={(e) => definir('parou_producao', e.target.checked)}
              className="mt-0.5 size-5 rounded border-slate-300 text-marca-600 focus:ring-marca-500 dark:border-slate-600 dark:bg-slate-900"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                A produção ficou parada
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Desmarque para intervenções feitas com a máquina rodando ou fora do turno — elas não
                entram no cálculo de disponibilidade.
              </span>
            </span>
          </label>
        </div>

        {/* ---------------- Tempos ---------------- */}
        <div className="space-y-4 border-t border-slate-200 pt-6 dark:border-slate-800">
          <div>
            <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Linha do tempo
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Abertura → atendimento gera o <strong>TA</strong>. Atendimento → fim gera o{' '}
              <strong>MTTR</strong>.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Abertura do chamado" obrigatorio erro={erros.aberto_em}>
              {(id) => (
                <Entrada
                  id={id}
                  type="datetime-local"
                  value={form.aberto_em}
                  onChange={(e) => definir('aberto_em', e.target.value)}
                  aria-invalid={Boolean(erros.aberto_em)}
                />
              )}
            </Campo>

            <Campo rotulo="Início do atendimento" erro={erros.atendido_em}>
              {(id) => (
                <Entrada
                  id={id}
                  type="datetime-local"
                  value={form.atendido_em}
                  min={form.aberto_em || undefined}
                  onChange={(e) => definir('atendido_em', e.target.value)}
                  aria-invalid={Boolean(erros.atendido_em)}
                />
              )}
            </Campo>

            <Campo rotulo="Fim do reparo" erro={erros.fim_em}>
              {(id) => (
                <Entrada
                  id={id}
                  type="datetime-local"
                  value={form.fim_em}
                  min={form.atendido_em || form.aberto_em || undefined}
                  onChange={(e) => definir('fim_em', e.target.value)}
                  aria-invalid={Boolean(erros.fim_em)}
                />
              )}
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Técnico responsável">
              {(id) => (
                <Selecao
                  id={id}
                  value={form.tecnico_id}
                  onChange={(e) => definir('tecnico_id', e.target.value)}
                >
                  <option value="">Não atribuído</option>
                  {somenteAtivos(lookups.tecnicos).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                      {t.especialidade ? ` — ${t.especialidade}` : ''}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>

            <Campo rotulo="O que foi feito" dica="Preencha ao encerrar o chamado.">
              {(id) => (
                <AreaTexto
                  id={id}
                  value={form.solucao}
                  onChange={(e) => definir('solucao', e.target.value)}
                  placeholder="Ex.: rolamento substituído e alinhamento refeito"
                  className="min-h-11"
                />
              )}
            </Campo>
          </div>
        </div>
      </form>
    </Modal>
  );
}
