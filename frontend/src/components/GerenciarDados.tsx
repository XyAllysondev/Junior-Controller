import { useRef, useState } from 'react';
import { Download, HardDriveDownload, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { Alerta, Botao, Cartao, Modal, useAviso } from './ui';
import { armazemNavegador } from '../lib/armazem';
import { ErroApi } from '../lib/api';

/**
 * No modo local os dados moram no navegador deste aparelho. Isso e otimo
 * pela simplicidade, mas significa que limpar os dados de navegacao apaga
 * o historico. Daqui o usuario tira um backup e restaura quando precisar -
 * inclusive para levar os dados para outro computador.
 */
export function GerenciarDados({ aoMudar }: { aoMudar: () => void }) {
  const avisar = useAviso();
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false);

  function baixarBackup() {
    try {
      const conteudo = armazemNavegador.backup!.exportar();
      const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
      const link = document.createElement('a');
      const hoje = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `manutencao-capricche-${hoje}.json`;
      link.click();
      URL.revokeObjectURL(url);
      avisar('Backup baixado. Guarde o arquivo em local seguro.');
    } catch {
      avisar('Não foi possível gerar o backup.', 'erro');
    }
  }

  async function restaurarBackup(arquivo: File) {
    try {
      armazemNavegador.backup!.importar(await arquivo.text());
      avisar('Backup restaurado.');
      aoMudar();
    } catch (e) {
      avisar(
        e instanceof ErroApi ? e.message : 'Arquivo inválido ou danificado.',
        'erro',
      );
    } finally {
      if (entradaArquivo.current) entradaArquivo.current.value = '';
    }
  }

  return (
    <>
      <Cartao
        className="mt-6"
        titulo="Backup dos dados"
        subtitulo="Os registros ficam salvos neste navegador. Baixe uma cópia de vez em quando."
      >
        <Alerta tom="alerta" titulo="Por que isso importa">
          Como não há servidor, tudo fica guardado <strong>neste aparelho e neste navegador</strong>.
          Limpar os dados de navegação apaga o histórico, e outro computador não enxerga esses
          registros. O backup é a forma de não perder nada — e de levar os dados para outra máquina.
        </Alerta>

        <div className="mt-4 flex flex-wrap gap-2">
          <Botao icone={<Download className="size-4" aria-hidden />} onClick={baixarBackup}>
            Baixar backup
          </Botao>

          <Botao
            variante="secundario"
            icone={<Upload className="size-4" aria-hidden />}
            onClick={() => entradaArquivo.current?.click()}
          >
            Restaurar backup
          </Botao>

          <input
            ref={entradaArquivo}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Escolher arquivo de backup"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void restaurarBackup(arquivo);
            }}
          />

          <Botao
            variante="secundario"
            icone={<Trash2 className="size-4" aria-hidden />}
            onClick={() => setConfirmandoLimpeza(true)}
            className="ml-auto text-rose-600 dark:text-rose-400"
          >
            Apagar tudo
          </Botao>
        </div>
      </Cartao>

      <Modal
        aberto={confirmandoLimpeza}
        aoFechar={() => setConfirmandoLimpeza(false)}
        titulo="Apagar todos os dados"
        largura="max-w-lg"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConfirmandoLimpeza(false)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              icone={<Trash2 className="size-4" aria-hidden />}
              onClick={() => {
                armazemNavegador.backup!.limpar();
                setConfirmandoLimpeza(false);
                avisar('Tudo apagado. O sistema voltou ao estado inicial.', 'info');
                aoMudar();
              }}
            >
              Apagar definitivamente
            </Botao>
          </>
        }
      >
        <div className="flex gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <TriangleAlert className="size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">Isso apaga todas as ocorrências e cadastros.</p>
            <p className="mt-1">
              Só os turnos e os motivos padrão voltam. Não há como desfazer.
            </p>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <HardDriveDownload className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
          Se ainda não baixou um backup, cancele e baixe antes.
        </p>
      </Modal>
    </>
  );
}
