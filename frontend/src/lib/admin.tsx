import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { aoMudarSessao, entrar as entrarAuth, sair as sairAuth, sessao } from './auth';
import { MODO_SUPABASE } from './api';

/* ---------------------------------------------------------------------
 * Quem é administrador.
 *
 * Só faz sentido no modo Supabase: é lá que existe banco com regra de
 * acesso. No modo navegador os dados são do próprio aparelho, então não
 * há de quem restringir — tudo fica liberado.
 *
 * Importante: esconder botões aqui é conveniência, não segurança. Quem
 * de fato barra cadastros e exclusões são as políticas do Postgres.
 * ------------------------------------------------------------------ */

type Contexto = {
  /** Pode mexer em cadastros e excluir registros. */
  ehAdmin: boolean;
  /** O sistema tem login? (falso no modo navegador) */
  temLogin: boolean;
  email: string | null;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
};

const ContextoAdmin = createContext<Contexto>({
  ehAdmin: true,
  temLogin: false,
  email: null,
  entrar: async () => {},
  sair: async () => {},
});

export const useAdmin = () => useContext(ContextoAdmin);

export function ProvedorAdmin({ children }: { children: ReactNode }) {
  const [atual, setAtual] = useState(() => sessao());

  useEffect(() => aoMudarSessao(setAtual), []);

  const temLogin = MODO_SUPABASE;

  return (
    <ContextoAdmin.Provider
      value={{
        // Sem login no sistema, todo mundo é administrador.
        ehAdmin: temLogin ? atual !== null : true,
        temLogin,
        email: atual?.email ?? null,
        entrar: async (email, senha) => {
          await entrarAuth(email, senha);
        },
        sair: sairAuth,
      }}
    >
      {children}
    </ContextoAdmin.Provider>
  );
}
