import type { ReactNode } from 'react';
import { cx, Esqueleto } from './ui';

type TomIndicador = 'marca' | 'sucesso' | 'alerta' | 'perigo' | 'info' | 'roxo';

const ACENTOS: Record<TomIndicador, { icone: string; barra: string }> = {
  marca: { icone: 'bg-marca-50 text-marca-600 dark:bg-marca-500/15 dark:text-marca-300', barra: 'bg-marca-500' },
  sucesso: { icone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', barra: 'bg-emerald-500' },
  alerta: { icone: 'bg-ouro-50 text-ouro-700 dark:bg-ouro-400/15 dark:text-ouro-300', barra: 'bg-ouro-400' },
  perigo: { icone: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', barra: 'bg-rose-500' },
  info: { icone: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', barra: 'bg-sky-500' },
  roxo: { icone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', barra: 'bg-violet-500' },
};

/**
 * Cartao de indicador: numero grande, rotulo curto e uma explicacao em
 * miudos - para quem nao vive de manutencao entender o que esta vendo.
 */
export function Indicador({
  rotulo,
  valor,
  unidade,
  ajuda,
  icone,
  tom = 'marca',
  rodape,
  progresso,
}: {
  rotulo: string;
  valor: ReactNode;
  unidade?: string;
  ajuda?: string;
  icone: ReactNode;
  tom?: TomIndicador;
  rodape?: ReactNode;
  /** 0 a 100: desenha uma barrinha embaixo do numero */
  progresso?: number | null;
}) {
  const acento = ACENTOS[tom];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className={cx('absolute inset-x-0 top-0 h-1', acento.barra)} aria-hidden />

      {/* Rotulo e icone dividem a primeira linha; o numero fica com a
          largura inteira do cartao, para nao quebrar em duas linhas. */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {rotulo}
        </p>
        <div className={cx('grid size-10 shrink-0 place-items-center rounded-xl', acento.icone)}>
          {icone}
        </div>
      </div>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums dark:text-slate-50">
          {valor}
        </span>
        {unidade && (
          <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">{unidade}</span>
        )}
      </p>

      {progresso !== undefined && progresso !== null && (
        <div
          className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={Math.round(progresso)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={rotulo}
        >
          <div
            className={cx('h-full rounded-full transition-[width] duration-500', acento.barra)}
            style={{ width: `${Math.min(Math.max(progresso, 0), 100)}%` }}
          />
        </div>
      )}

      {ajuda && <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{ajuda}</p>}
      {rodape && <div className="mt-3">{rodape}</div>}
    </div>
  );
}

export function IndicadorEsqueleto() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <Esqueleto className="h-3 w-24" />
          <Esqueleto className="h-8 w-20" />
        </div>
        <Esqueleto className="size-11" />
      </div>
      <Esqueleto className="mt-4 h-3 w-full" />
    </div>
  );
}
