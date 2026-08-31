import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';

/**
 * Tooltip padrao dos graficos. O recharts entrega os itens da serie e
 * aqui so cuidamos da aparencia + formatacao em pt-BR.
 */
export function DicaGrafico({
  active,
  payload,
  label,
  formatarRotulo,
  formatarValor,
}: {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  formatarRotulo?: (v: any) => string;
  formatarValor?: (valor: number, nome: string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      {label !== undefined && (
        <p className="mb-1.5 font-bold text-slate-800 dark:text-slate-100">
          {formatarRotulo ? formatarRotulo(label) : String(label)}
        </p>
      )}
      <ul className="space-y-1">
        {payload.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: item.color || item.fill }}
              aria-hidden
            />
            <span className="text-slate-500 dark:text-slate-400">{item.name}</span>
            <span className="ml-auto font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {formatarValor
                ? formatarValor(Number(item.value), String(item.name))
                : Number(item.value).toLocaleString('pt-BR')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Placeholder quando o filtro nao retorna nada. */
export function SemDados({ texto = 'Sem dados no período selecionado' }: { texto?: string }) {
  return (
    <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
      <BarChart3 className="size-8" aria-hidden />
      <p className="text-sm font-medium">{texto}</p>
    </div>
  );
}

/**
 * Descricao textual do grafico para leitores de tela: o desenho fica
 * aria-hidden e este resumo e o que e anunciado.
 */
export function ResumoAcessivel({ children }: { children: ReactNode }) {
  return <p className="sr-only">{children}</p>;
}
