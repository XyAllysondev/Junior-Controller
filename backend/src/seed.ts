import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, migrate, turnoDoHorario } from './db.js';

/* ---------------------------------------------------------------------
 * Dados de exemplo para a aplicacao ja abrir com graficos preenchidos.
 * Rode com:  npm run seed
 * ------------------------------------------------------------------ */

const SETORES = ['Extrusao', 'Injecao', 'Montagem', 'Acabamento', 'Utilidades'];

const MAQUINAS: [string, string, string, 'Baixa' | 'Media' | 'Alta'][] = [
  ['EXT-01', 'Extrusora Dupla Rosca 90mm', 'Extrusao', 'Alta'],
  ['EXT-02', 'Extrusora Mono Rosca 65mm', 'Extrusao', 'Media'],
  ['INJ-01', 'Injetora 250 ton', 'Injecao', 'Alta'],
  ['INJ-02', 'Injetora 150 ton', 'Injecao', 'Media'],
  ['INJ-03', 'Injetora 80 ton', 'Injecao', 'Baixa'],
  ['MON-01', 'Linha de Montagem A', 'Montagem', 'Alta'],
  ['MON-02', 'Linha de Montagem B', 'Montagem', 'Media'],
  ['ACB-01', 'Esteira de Acabamento', 'Acabamento', 'Media'],
  ['ACB-02', 'Prensa Hidraulica 40t', 'Acabamento', 'Alta'],
  ['UTL-01', 'Compressor de Ar 100cv', 'Utilidades', 'Alta'],
  ['UTL-02', 'Chiller 60TR', 'Utilidades', 'Media'],
  ['UTL-03', 'Caldeira Vapor', 'Utilidades', 'Baixa'],
];

const MOTIVOS: [string, string][] = [
  ['Rolamento danificado', 'Mecanica'],
  ['Correia rompida', 'Mecanica'],
  ['Desalinhamento de eixo', 'Mecanica'],
  ['Sensor com falha', 'Automacao'],
  ['Inversor de frequencia em alarme', 'Eletrica'],
  ['Curto no painel', 'Eletrica'],
  ['Vazamento hidraulico', 'Hidraulica'],
  ['Pressao de ar insuficiente', 'Pneumatica'],
  ['Cilindro pneumatico travado', 'Pneumatica'],
  ['Falha de operacao', 'Operacional'],
  ['Troca de ferramental', 'Setup'],
  ['Ajuste de qualidade', 'Qualidade'],
  ['Lubrificacao programada', 'Mecanica'],
];

const TECNICOS: [string, string, string][] = [
  ['Carlos Menezes', '10234', 'Mecanica'],
  ['Ana Ribeiro', '10456', 'Eletrica'],
  ['Jorge Tavares', '10871', 'Automacao'],
  ['Patricia Lopes', '11002', 'Hidraulica'],
  ['Rafael Nunes', '11345', 'Mecanica'],
  ['Simone Prado', '11590', 'Eletrica'],
];

const DESCRICOES = [
  'Maquina parou durante o ciclo, operador acionou a manutencao',
  'Ruido anormal e vibracao acima do normal',
  'Alarme no painel travando a partida',
  'Perda de pressao durante a producao',
  'Refugo acima do aceitavel, suspeita de desajuste',
  'Parada programada para inspecao preventiva',
  'Vazamento identificado pelo operador no inicio do turno',
  'Superaquecimento detectado no motor principal',
  'Falha intermitente no acionamento',
  'Troca de ferramental para o proximo lote',
];

const SOLUCOES = [
  'Componente substituido e maquina testada em vazio antes de liberar',
  'Reaperto e realinhamento realizados, maquina liberada',
  'Peca trocada por sobressalente do almoxarifado',
  'Ajuste de parametro no painel e limpeza dos sensores',
  'Lubrificacao e regulagem executadas conforme plano',
  'Reparo provisorio; peca definitiva solicitada ao suprimentos',
];

const sortear = <T>(lista: T[]): T => lista[Math.floor(Math.random() * lista.length)];
const entre = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function formatar(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:00`;
}

export function popularBaseDeExemplo(): void {
  const inserir = db.transaction(() => {
    const insSetor = db.prepare('INSERT OR IGNORE INTO setores (nome) VALUES (?)');
    for (const nome of SETORES) insSetor.run(nome);

    const idSetor = (nome: string) =>
      (db.prepare('SELECT id FROM setores WHERE nome = ?').get(nome) as { id: number }).id;

    const insMaquina = db.prepare(
      'INSERT OR IGNORE INTO maquinas (codigo, nome, setor_id, criticidade) VALUES (?,?,?,?)',
    );
    for (const [codigo, nome, setor, crit] of MAQUINAS) {
      insMaquina.run(codigo, nome, idSetor(setor), crit);
    }

    const insMotivo = db.prepare('INSERT OR IGNORE INTO motivos (nome, categoria) VALUES (?,?)');
    for (const [nome, cat] of MOTIVOS) insMotivo.run(nome, cat);

    const insTecnico = db.prepare(
      'INSERT OR IGNORE INTO tecnicos (nome, matricula, especialidade) VALUES (?,?,?)',
    );
    for (const [nome, mat, esp] of TECNICOS) insTecnico.run(nome, mat, esp);

    const maquinas = db.prepare('SELECT id, criticidade FROM maquinas').all() as {
      id: number;
      criticidade: string;
    }[];
    const motivos = db.prepare('SELECT id, categoria FROM motivos').all() as {
      id: number;
      categoria: string;
    }[];
    const tecnicos = db.prepare('SELECT id FROM tecnicos').all() as { id: number }[];

    const insOcorrencia = db.prepare(
      `INSERT INTO ocorrencias
        (maquina_id, motivo_id, tecnico_id, turno_id, tipo, prioridade, status,
         descricao, solucao, parou_producao, aberto_em, atendido_em, fim_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );

    const TOTAL = 180;
    const agoraMs = Date.now();

    for (let i = 0; i < TOTAL; i++) {
      const maquina = sortear(maquinas);
      const motivo = sortear(motivos);

      // Espalha as aberturas nos ultimos 45 dias
      const diasAtras = Math.random() * 45;
      const abertura = new Date(agoraMs - diasAtras * 86_400_000);
      abertura.setHours(entre(0, 23), entre(0, 59), 0, 0);
      // Sortear a hora pode jogar a abertura para o futuro; puxa um dia para tras.
      if (abertura.getTime() > agoraMs) abertura.setDate(abertura.getDate() - 1);

      const tipo =
        motivo.categoria === 'Setup'
          ? 'Corretiva'
          : Math.random() < 0.2
            ? 'Preventiva'
            : Math.random() < 0.06
              ? 'Melhoria'
              : 'Corretiva';

      const prioridade =
        maquina.criticidade === 'Alta'
          ? sortear(['Alta', 'Critica', 'Alta', 'Media'])
          : sortear(['Baixa', 'Media', 'Media', 'Alta']);

      // Chamados muito recentes ficam em aberto, o resto ja foi resolvido
      const recente = diasAtras < 1.2;
      const sorteioStatus = Math.random();

      let atendidoEm: string | null = null;
      let fimEm: string | null = null;
      let status = 'Aberta';

      if (!recente || sorteioStatus > 0.35) {
        const taMin = entre(3, 75);
        const atendido = new Date(abertura.getTime() + taMin * 60_000);
        atendidoEm = formatar(atendido);
        status = 'Em atendimento';

        if (!recente || sorteioStatus > 0.6) {
          const reparoMin = entre(10, 420);
          fimEm = formatar(new Date(atendido.getTime() + reparoMin * 60_000));
          status = 'Concluida';
        }
      }

      const abertoEm = formatar(abertura);

      insOcorrencia.run(
        maquina.id,
        motivo.id,
        atendidoEm ? sortear(tecnicos).id : null,
        turnoDoHorario(abertoEm),
        tipo,
        prioridade,
        status,
        sortear(DESCRICOES),
        fimEm ? sortear(SOLUCOES) : null,
        tipo === 'Preventiva' && Math.random() < 0.4 ? 0 : 1,
        abertoEm,
        atendidoEm,
        fimEm,
      );
    }

    // Alguns chamados garantidamente em aberto, para o painel nao abrir vazio.
    const PENDENTES: [number, 'Aberta' | 'Em atendimento', string][] = [
      [0.4, 'Aberta', 'Critica'],
      [1.5, 'Aberta', 'Alta'],
      [3, 'Em atendimento', 'Alta'],
      [6, 'Em atendimento', 'Media'],
      [11, 'Aberta', 'Media'],
      [20, 'Em atendimento', 'Baixa'],
    ];

    for (const [horasAtras, status, prioridade] of PENDENTES) {
      const abertura = new Date(agoraMs - horasAtras * 3_600_000);
      const abertoEm = formatar(abertura);
      const atendidoEm =
        status === 'Em atendimento'
          ? formatar(new Date(abertura.getTime() + entre(5, 40) * 60_000))
          : null;

      insOcorrencia.run(
        sortear(maquinas).id,
        sortear(motivos).id,
        atendidoEm ? sortear(tecnicos).id : null,
        turnoDoHorario(abertoEm),
        'Corretiva',
        prioridade,
        status,
        sortear(DESCRICOES),
        null,
        1,
        abertoEm,
        atendidoEm,
        null,
      );
    }
  });

  inserir();
}

/* Execucao direta: npm run seed */
const esteArquivo = fileURLToPath(import.meta.url);
const chamado = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (chamado && path.resolve(esteArquivo) === chamado) {
  migrate();
  popularBaseDeExemplo();
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM ocorrencias').get() as { n: number };
  console.log(`[seed] pronto - ${n} ocorrencias no banco.`);
}
