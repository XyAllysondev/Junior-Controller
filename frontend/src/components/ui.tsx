import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';

export const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ');

/* ==================================================================== */
/* Cartao                                                               */
/* ==================================================================== */
export function Cartao({
  titulo,
  subtitulo,
  acao,
  children,
  className,
  semPadding,
}: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  semPadding?: boolean;
}) {
  return (
    <section
      className={cx(
        'rounded-2xl border border-slate-200 bg-white shadow-sm',
        'dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {(titulo || acao) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            {titulo && (
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {titulo}
              </h2>
            )}
            {subtitulo && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitulo}</p>
            )}
          </div>
          {acao && <div className="flex shrink-0 items-center gap-2">{acao}</div>}
        </header>
      )}
      <div className={semPadding ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

/* ==================================================================== */
/* Botao                                                                */
/* ==================================================================== */
type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'sucesso';

const ESTILOS_BOTAO: Record<VarianteBotao, string> = {
  primario:
    'bg-marca-600 text-white shadow-sm hover:bg-marca-700 active:bg-marca-800 dark:bg-marca-500 dark:hover:bg-marca-400 dark:active:bg-marca-600',
  secundario:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  fantasma:
    'text-slate-600 hover:bg-slate-200/70 active:bg-slate-300/70 dark:text-slate-300 dark:hover:bg-slate-800',
  perigo:
    'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500',
  sucesso:
    'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500',
};

export function Botao({
  variante = 'primario',
  tamanho = 'medio',
  icone,
  carregando,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
  tamanho?: 'pequeno' | 'medio' | 'grande';
  icone?: ReactNode;
  carregando?: boolean;
}) {
  const tamanhos = {
    pequeno: 'h-9 px-3 text-sm gap-1.5',
    medio: 'h-11 px-4 text-sm gap-2',
    grande: 'h-12 px-6 text-base gap-2',
  };

  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      className={cx(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        tamanhos[tamanho],
        ESTILOS_BOTAO[variante],
        className,
      )}
    >
      {carregando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icone}
      {children}
    </button>
  );
}

/* ==================================================================== */
/* Campos de formulario                                                 */
/* ==================================================================== */
const BASE_CAMPO =
  'w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 transition-colors ' +
  'focus:border-marca-500 focus:ring-4 focus:ring-marca-500/15 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-slate-100 ' +
  'dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 ' +
  'dark:disabled:bg-slate-900';

export function Campo({
  rotulo,
  dica,
  erro,
  obrigatorio,
  children,
  className,
}: {
  rotulo: string;
  dica?: string;
  erro?: string;
  obrigatorio?: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        {rotulo}
        {obrigatorio && (
          <span className="ml-1 text-rose-600 dark:text-rose-400" aria-label="obrigatorio">
            *
          </span>
        )}
      </label>
      {children(id)}
      {erro ? (
        <p className="flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {erro}
        </p>
      ) : (
        dica && <p className="text-xs text-slate-500 dark:text-slate-400">{dica}</p>
      )}
    </div>
  );
}

export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(BASE_CAMPO, 'h-11', className)} />;
}

export function Selecao({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(BASE_CAMPO, 'h-11 cursor-pointer pr-8', className)}>
      {children}
    </select>
  );
}

export function AreaTexto({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(BASE_CAMPO, 'min-h-24 py-2.5 leading-relaxed', className)} />;
}

/* ==================================================================== */
/* Etiqueta / Badge                                                     */
/* ==================================================================== */
export type Tom =
  | 'neutro'
  | 'marca'
  | 'sucesso'
  | 'alerta'
  | 'perigo'
  | 'info'
  | 'roxo'
  | 'laranja';

const TONS: Record<Tom, string> = {
  neutro: 'bg-slate-100 text-slate-700 ring-slate-300/60 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  marca: 'bg-marca-50 text-marca-700 ring-marca-300/60 dark:bg-marca-500/15 dark:text-marca-300 dark:ring-marca-500/30',
  sucesso: 'bg-emerald-50 text-emerald-700 ring-emerald-300/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  alerta: 'bg-ouro-50 text-ouro-800 ring-ouro-300/70 dark:bg-ouro-400/15 dark:text-ouro-300 dark:ring-ouro-400/30',
  perigo: 'bg-rose-50 text-rose-700 ring-rose-300/60 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
  info: 'bg-sky-50 text-sky-700 ring-sky-300/60 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
  roxo: 'bg-violet-50 text-violet-700 ring-violet-300/60 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
  laranja: 'bg-orange-50 text-orange-700 ring-orange-300/60 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30',
};

export function Etiqueta({
  tom = 'neutro',
  children,
  icone,
  className,
}: {
  tom?: Tom;
  children: ReactNode;
  icone?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap',
        TONS[tom],
        className,
      )}
    >
      {icone}
      {children}
    </span>
  );
}

/* ==================================================================== */
/* Estados de tela                                                      */
/* ==================================================================== */
export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 py-14 text-slate-500 dark:text-slate-400"
    >
      <Loader2 className="size-7 animate-spin text-marca-500" aria-hidden />
      <span className="text-sm font-medium">{texto}</span>
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      className={cx('animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/80', className)}
      aria-hidden
    />
  );
}

export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone?: ReactNode;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icone && (
        <div className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          {icone}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{titulo}</h3>
      {descricao && (
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
      )}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

export function Alerta({
  tom = 'perigo',
  titulo,
  children,
}: {
  tom?: 'perigo' | 'alerta' | 'info';
  titulo?: string;
  children: ReactNode;
}) {
  const estilos = {
    perigo: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
    alerta: 'border-ouro-300 bg-ouro-50 text-ouro-900 dark:border-ouro-400/30 dark:bg-ouro-400/10 dark:text-ouro-200',
    info: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
  };
  const icones = {
    perigo: <XCircle className="size-5 shrink-0" aria-hidden />,
    alerta: <AlertTriangle className="size-5 shrink-0" aria-hidden />,
    info: <Info className="size-5 shrink-0" aria-hidden />,
  };
  return (
    <div className={cx('flex gap-3 rounded-xl border p-4 text-sm', estilos[tom])} role="alert">
      {icones[tom]}
      <div>
        {titulo && <p className="font-bold">{titulo}</p>}
        <div className={titulo ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  );
}

/* ==================================================================== */
/* Modal acessivel                                                      */
/* ==================================================================== */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = 'max-w-2xl',
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!aberto) return;

    const anterior = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    // Foca o primeiro campo utilizavel do formulario
    const t = window.setTimeout(() => {
      const alvo = caixa.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), select, textarea, button',
      );
      alvo?.focus();
    }, 30);

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        aoFechar();
        return;
      }
      // Mantem o Tab girando dentro do modal
      if (e.key === 'Tab' && caixa.current) {
        const focaveis = caixa.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focaveis.length) return;
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
      window.clearTimeout(t);
      anterior?.focus?.();
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={aoFechar}
        aria-hidden
      />
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={cx(
          'animar-entrada relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl',
          'sm:rounded-2xl dark:bg-slate-900',
          largura,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 id={tituloId} className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {titulo}
            </h2>
            {descricao && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
            )}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {rodape && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50">
            {rodape}
          </footer>
        )}
      </div>
    </div>
  );
}

/* ==================================================================== */
/* Avisos (toasts)                                                      */
/* ==================================================================== */
type Aviso = { id: number; texto: string; tom: 'sucesso' | 'erro' | 'info' };

const ContextoAvisos = createContext<(texto: string, tom?: Aviso['tom']) => void>(() => {});

export const useAviso = () => useContext(ContextoAvisos);

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const avisar = (texto: string, tom: Aviso['tom'] = 'sucesso') => {
    const id = Date.now() + Math.random();
    setAvisos((atuais) => [...atuais, { id, texto, tom }]);
    window.setTimeout(() => setAvisos((atuais) => atuais.filter((a) => a.id !== id)), 4500);
  };

  const icones = {
    sucesso: <CheckCircle2 className="size-5 shrink-0 text-emerald-500" aria-hidden />,
    erro: <XCircle className="size-5 shrink-0 text-rose-500" aria-hidden />,
    info: <Info className="size-5 shrink-0 text-sky-500" aria-hidden />,
  };

  return (
    <ContextoAvisos.Provider value={avisar}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-60 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            className="animar-subida pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm font-medium text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {icones[a.tom]}
            <span className="flex-1">{a.texto}</span>
            <button
              type="button"
              onClick={() => setAvisos((atuais) => atuais.filter((x) => x.id !== a.id))}
              aria-label="Dispensar aviso"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}
