import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ClipboardList, Database, Gauge, Menu, Moon, Sun, Timer, X } from 'lucide-react';
import { cx } from './ui';
import { useTema } from '../lib/hooks';

const MENU = [
  { para: '/', rotulo: 'Painel', descricao: 'Indicadores e gráficos', icone: Gauge },
  {
    para: '/ocorrencias',
    rotulo: 'Ocorrências',
    descricao: 'Paradas e chamados',
    icone: ClipboardList,
  },
  { para: '/ta', rotulo: 'TA por Turno', descricao: 'Tempo de atendimento', icone: Timer },
  {
    para: '/cadastros',
    rotulo: 'Cadastros',
    descricao: 'Máquinas, setores, equipe',
    icone: Database,
  },
];

/**
 * Marca completa (coracao + placa "Manutencao Eletrica"), sobre uma placa
 * branca. O coracao e vermelho e a barra lateral tambem: sem esse fundo
 * claro por tras, o logo se perderia no degrade.
 */
function MarcaCompleta() {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-lg shadow-marca-950/25 ring-1 ring-white/50">
      <img
        src="/logo-capricche.jpg"
        alt="Capricche — Manutenção Elétrica"
        width={660}
        height={712}
        className="mx-auto w-full max-w-45"
      />
    </div>
  );
}

/** Versao compacta (so o coracao) para a barra do celular. */
function MarcaIcone() {
  return (
    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 shadow-sm ring-white/50">
      <img
        src="/logo-icone.jpg"
        alt="Capricche"
        width={256}
        height={256}
        className="size-full object-cover"
      />
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const { escuro, alternarTema } = useTema();
  const local = useLocation();

  // Fecha o menu lateral ao trocar de pagina no celular
  useEffect(() => setMenuAberto(false), [local.pathname]);

  return (
    <div className="min-h-screen lg:flex">
      <a href="#conteudo" className="pular-link">
        Pular para o conteúdo
      </a>

      {/* Fundo escurecido do menu no celular */}
      {menuAberto && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden
        />
      )}

      {/* ---------------- Menu lateral ---------------- */}
      <aside
        className={cx(
          'barra-marca fixed inset-y-0 left-0 z-40 flex w-72 flex-col text-white shadow-2xl lg:w-64 xl:w-72',
          'transition-transform duration-200',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          menuAberto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="p-4">
          <div className="mb-2 flex justify-end lg:hidden">
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar menu"
              className="grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <MarcaCompleta />
        </div>

        {/* Fio dourado, o mesmo da fita do logo */}
        <div className="fio-ouro mx-5 h-px opacity-70" aria-hidden />

        <nav aria-label="Menu principal" className="flex-1 space-y-1 overflow-y-auto p-3">
          {MENU.map(({ para, rotulo, descricao, icone: Icone }) => (
            <NavLink
              key={para}
              to={para}
              end={para === '/'}
              className={({ isActive }) =>
                cx(
                  'group flex items-start gap-3 rounded-xl px-3 py-3 transition-colors',
                  isActive
                    ? 'bg-white text-marca-800 shadow-lg shadow-marca-950/25'
                    : 'text-white/85 hover:bg-white/10 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icone
                    className={cx(
                      'mt-0.5 size-5 shrink-0',
                      isActive ? 'text-marca-600' : 'text-ouro-200/80 group-hover:text-ouro-200',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{rotulo}</span>
                    <span
                      className={cx(
                        'block text-xs',
                        isActive ? 'text-marca-500' : 'text-white/55',
                      )}
                    >
                      {descricao}
                    </span>
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3">
          <button
            type="button"
            onClick={alternarTema}
            aria-pressed={escuro}
            className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            {escuro ? (
              <Sun className="size-5 text-ouro-200" aria-hidden />
            ) : (
              <Moon className="size-5 text-ouro-200" aria-hidden />
            )}
            {escuro ? 'Tema claro' : 'Tema escuro'}
          </button>
          <p className="mt-3 px-1 text-center text-[11px] leading-relaxed text-white/45">
            Controle de manutenção de máquinas
          </p>
        </div>
      </aside>

      {/* ---------------- Conteúdo ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra do topo, só no celular/tablet */}
        <header className="barra-marca sticky top-0 z-20 flex items-center gap-3 px-4 py-3 text-white shadow-lg lg:hidden">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
            className="grid size-10 place-items-center rounded-lg bg-white/10 text-white"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <MarcaIcone />
            <div className="min-w-0 leading-tight">
              <span className="block truncate font-extrabold tracking-tight">Capricche</span>
              <span className="block truncate text-[11px] font-semibold text-ouro-200">
                Manutenção Elétrica
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={alternarTema}
            aria-label={escuro ? 'Ativar tema claro' : 'Ativar tema escuro'}
            className="ml-auto grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 text-white"
          >
            {escuro ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
          </button>
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-6 xl:p-8">
          {children}
        </main>

        <footer className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
          Capricche · Manutenção Elétrica — dados lidos em tempo real do banco local
        </footer>
      </div>
    </div>
  );
}

/** Cabecalho padrao das paginas. */
export function TituloPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
