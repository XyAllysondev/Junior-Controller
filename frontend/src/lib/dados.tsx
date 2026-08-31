import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ErroApi, type Lookups } from './api';

/* ---------------------------------------------------------------------
 * Os cadastros (maquinas, setores, motivos, tecnicos, turnos) sao usados
 * por praticamente todas as telas. Carregamos uma vez e compartilhamos.
 * ------------------------------------------------------------------ */

const VAZIO: Lookups = { setores: [], maquinas: [], motivos: [], tecnicos: [], turnos: [] };

type Contexto = {
  lookups: Lookups;
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
};

const ContextoLookups = createContext<Contexto>({
  lookups: VAZIO,
  carregando: true,
  erro: null,
  recarregar: async () => {},
});

export const useLookups = () => useContext(ContextoLookups);

export function ProvedorLookups({ children }: { children: ReactNode }) {
  const [lookups, setLookups] = useState<Lookups>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setLookups(await api.get<Lookups>('/lookups'));
    } catch (e) {
      setErro(
        e instanceof ErroApi ? e.message : 'Nao foi possivel carregar os cadastros do sistema.',
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return (
    <ContextoLookups.Provider value={{ lookups, carregando, erro, recarregar }}>
      {children}
    </ContextoLookups.Provider>
  );
}

/* Atalhos usados nos formularios: so o que esta ativo aparece para escolher. */
export const somenteAtivos = <T extends { ativo: number }>(lista: T[]) =>
  lista.filter((item) => item.ativo === 1);
