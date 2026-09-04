import { useEffect, useState } from 'react';
import { LogIn, LogOut, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Alerta, Botao, Campo, Entrada, Modal, useAviso } from './ui';
import { useAdmin } from '../lib/admin';

/**
 * Botão do menu lateral + tela de entrada.
 *
 * Só aparece quando o sistema está ligado no Supabase: é lá que existe
 * banco com regra de acesso para o login significar alguma coisa.
 */
export function Administrador() {
  const { ehAdmin, temLogin, email, entrar, sair } = useAdmin();
  const avisar = useAviso();

  const [aberto, setAberto] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setSenha('');
      setErro(null);
    }
  }, [aberto]);

  if (!temLogin) return null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(usuario, senha);
      setAberto(false);
      avisar('Você entrou como administrador.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  if (ehAdmin) {
    return (
      <div className="rounded-xl bg-white/10 px-3 py-2.5">
        <p className="flex items-center gap-2 text-xs font-bold text-ouro-200">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Administrador
        </p>
        <p className="mt-0.5 truncate text-[11px] text-white/60" title={email ?? undefined}>
          {email}
        </p>
        <button
          type="button"
          onClick={async () => {
            await sair();
            avisar('Você saiu do modo administrador.', 'info');
          }}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 underline-offset-2 hover:text-white hover:underline"
        >
          <LogOut className="size-3.5" aria-hidden />
          Sair
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <ShieldQuestion className="size-5 shrink-0 text-ouro-200" aria-hidden />
        Entrar como administrador
      </button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Entrar como administrador"
        descricao="Necessário para mexer nos cadastros e excluir registros."
        largura="max-w-md"
        rodape={
          <>
            <Botao variante="secundario" type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao
              type="submit"
              form="form-login"
              carregando={enviando}
              icone={<LogIn className="size-4" aria-hidden />}
            >
              Entrar
            </Botao>
          </>
        }
      >
        <form id="form-login" onSubmit={enviar} className="space-y-4" noValidate>
          {erro && <Alerta>{erro}</Alerta>}

          <Campo rotulo="E-mail" obrigatorio>
            {(id) => (
              <Entrada
                id={id}
                type="email"
                autoComplete="username"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="voce@empresa.com.br"
              />
            )}
          </Campo>

          <Campo rotulo="Senha" obrigatorio>
            {(id) => (
              <Entrada
                id={id}
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            )}
          </Campo>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sem entrar, dá para acompanhar o painel, registrar paradas, atender e concluir
            chamados normalmente. O login só é preciso para mexer nos cadastros e apagar
            registros.
          </p>
        </form>
      </Modal>
    </>
  );
}
