import { useCallback, useEffect, useRef, useState } from 'react';
import { ErroApi } from './api';

/* ---------------------------------------------------------------------
 * useTema - alterna claro/escuro e lembra a escolha
 * ------------------------------------------------------------------ */
const CHAVE_TEMA = 'tema-manutencao';

export function useTema() {
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', escuro);
    try {
      localStorage.setItem(CHAVE_TEMA, escuro ? 'escuro' : 'claro');
    } catch {
      /* navegador sem storage: apenas mantem na sessao */
    }
  }, [escuro]);

  return { escuro, alternarTema: () => setEscuro((v) => !v) };
}

/* ---------------------------------------------------------------------
 * useApi - busca dados com estado de carregamento e erro
 *
 * A chave (string) define quando refazer a busca. Guardar os filtros em
 * uma string evita o problema classico de dependencia por objeto novo a
 * cada render.
 * ------------------------------------------------------------------ */
export function useApi<T>(buscar: () => Promise<T>, chave: string) {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;

  const [gatilho, setGatilho] = useState(0);
  const recarregar = useCallback(() => setGatilho((n) => n + 1), []);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);

    buscarRef
      .current()
      .then((resultado) => {
        if (!cancelado) setDados(resultado);
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setErro(e instanceof ErroApi ? e.message : 'Erro inesperado ao carregar os dados.');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [chave, gatilho]);

  return { dados, carregando, erro, recarregar };
}

/* ---------------------------------------------------------------------
 * useDebounce - segura o valor por alguns ms (usado na busca por texto)
 * ------------------------------------------------------------------ */
export function useDebounce<T>(valor: T, ms = 350): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setAtrasado(valor), ms);
    return () => window.clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

/* ---------------------------------------------------------------------
 * useLarguraJanela - para adaptar graficos em telas pequenas
 * ------------------------------------------------------------------ */
export function useEhTelaPequena(limite = 768) {
  const [pequena, setPequena] = useState(() => window.innerWidth < limite);
  useEffect(() => {
    const aoRedimensionar = () => setPequena(window.innerWidth < limite);
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, [limite]);
  return pequena;
}
