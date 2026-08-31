import type { ReactNode } from 'react';
import { CalendarRange, RotateCcw } from 'lucide-react';
import { Botao, cx, Entrada, Selecao } from './ui';
import { somenteAtivos, useLookups } from '../lib/dados';
import { diaISO } from '../lib/formato';

export type FiltrosPeriodo = {
  de: string;
  ate: string;
  setor_id: string;
  turno_id: string;
  maquina_id: string;
};

export const filtrosPadrao = (dias = 30): FiltrosPeriodo => ({
  de: diaISO(dias - 1),
  ate: diaISO(0),
  setor_id: 'todos',
  turno_id: 'todos',
  maquina_id: 'todos',
});

const ATALHOS: { rotulo: string; dias: number }[] = [
  { rotulo: 'Hoje', dias: 1 },
  { rotulo: '7 dias', dias: 7 },
  { rotulo: '30 dias', dias: 30 },
  { rotulo: '90 dias', dias: 90 },
];

/**
 * Barra de filtros compartilhada pelo Painel e pelo TA por Turno.
 * Os atalhos de periodo evitam que o usuario tenha que mexer em datas
 * no dia a dia.
 */
export function Filtros({
  valores,
  aoMudar,
  mostrarMaquina = true,
  mostrarTurno = true,
  extra,
}: {
  valores: FiltrosPeriodo;
  aoMudar: (novos: FiltrosPeriodo) => void;
  mostrarMaquina?: boolean;
  mostrarTurno?: boolean;
  extra?: ReactNode;
}) {
  const { lookups } = useLookups();
  const definir = (campo: keyof FiltrosPeriodo, valor: string) =>
    aoMudar({ ...valores, [campo]: valor });

  const maquinasVisiveis = somenteAtivos(lookups.maquinas).filter(
    (m) => valores.setor_id === 'todos' || String(m.setor_id) === valores.setor_id,
  );

  const atalhoAtivo = (dias: number) =>
    valores.de === diaISO(dias - 1) && valores.ate === diaISO(0);

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          <CalendarRange className="size-4" aria-hidden />
          Período
        </span>
        {ATALHOS.map(({ rotulo, dias }) => (
          <button
            key={rotulo}
            type="button"
            aria-pressed={atalhoAtivo(dias)}
            onClick={() => aoMudar({ ...valores, de: diaISO(dias - 1), ate: diaISO(0) })}
            className={cx(
              'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
              atalhoAtivo(dias)
                ? 'bg-marca-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            )}
          >
            {rotulo}
          </button>
        ))}

        <Botao
          variante="fantasma"
          tamanho="pequeno"
          icone={<RotateCcw className="size-4" aria-hidden />}
          onClick={() => aoMudar(filtrosPadrao(30))}
          className="ml-auto"
        >
          Limpar filtros
        </Botao>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">De</span>
          <Entrada
            type="date"
            value={valores.de}
            max={valores.ate}
            onChange={(e) => definir('de', e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Até</span>
          <Entrada
            type="date"
            value={valores.ate}
            min={valores.de}
            onChange={(e) => definir('ate', e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Setor</span>
          <Selecao
            value={valores.setor_id}
            onChange={(e) => aoMudar({ ...valores, setor_id: e.target.value, maquina_id: 'todos' })}
          >
            <option value="todos">Todos os setores</option>
            {somenteAtivos(lookups.setores).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Selecao>
        </label>

        {mostrarMaquina && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Máquina</span>
            <Selecao
              value={valores.maquina_id}
              onChange={(e) => definir('maquina_id', e.target.value)}
            >
              <option value="todos">Todas as máquinas</option>
              {maquinasVisiveis.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigo} — {m.nome}
                </option>
              ))}
            </Selecao>
          </label>
        )}

        {mostrarTurno && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Turno</span>
            <Selecao value={valores.turno_id} onChange={(e) => definir('turno_id', e.target.value)}>
              <option value="todos">Todos os turnos</option>
              {somenteAtivos(lookups.turnos).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} ({t.hora_inicio}–{t.hora_fim})
                </option>
              ))}
            </Selecao>
          </label>
        )}

        {extra}
      </div>
    </div>
  );
}
