import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InStatement } from '@libsql/client';
import { agora, db, migrar, todos, um } from './db.js';

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

type Turno = { id: number; hora_inicio: string; hora_fim: string };

/** Versao local de turnoDoHorario: os turnos ja estao carregados em memoria. */
function turnoDe(turnos: Turno[], dataHora: string): number | null {
  const hhmm = dataHora.slice(11, 16);
  for (const t of turnos) {
    const viraODia = t.hora_fim <= t.hora_inicio;
    const dentro = viraODia
      ? hhmm >= t.hora_inicio || hhmm < t.hora_fim
      : hhmm >= t.hora_inicio && hhmm < t.hora_fim;
    if (dentro) return t.id;
  }
  return null;
}

export async function popularBaseDeExemplo(): Promise<void> {
  /* -------- Cadastros -------- */
  const cadastros: InStatement[] = [];
  for (const nome of SETORES) {
    cadastros.push({ sql: 'INSERT OR IGNORE INTO setores (nome, criado_em) VALUES (?,?)', args: [nome, agora()] });
  }
  for (const [nome, cat] of MOTIVOS) {
    cadastros.push({
      sql: 'INSERT OR IGNORE INTO motivos (nome, categoria, criado_em) VALUES (?,?,?)',
      args: [nome, cat, agora()],
    });
  }
  for (const [nome, mat, esp] of TECNICOS) {
    cadastros.push({
      sql: 'INSERT OR IGNORE INTO tecnicos (nome, matricula, especialidade, criado_em) VALUES (?,?,?,?)',
      args: [nome, mat, esp, agora()],
    });
  }
  await db.batch(cadastros, 'write');

  /* -------- Maquinas (dependem dos setores) -------- */
  const setores = await todos<{ id: number; nome: string }>('SELECT id, nome FROM setores');
  const idSetor = (nome: string) => setores.find((s) => s.nome === nome)?.id ?? null;

  await db.batch(
    MAQUINAS.map(([codigo, nome, setor, crit]) => ({
      sql: 'INSERT OR IGNORE INTO maquinas (codigo, nome, setor_id, criticidade, criado_em) VALUES (?,?,?,?,?)',
      args: [codigo, nome, idSetor(setor), crit, agora()],
    })),
    'write',
  );

  /* -------- Ocorrencias -------- */
  const maquinas = await todos<{ id: number; criticidade: string }>(
    'SELECT id, criticidade FROM maquinas',
  );
  const motivos = await todos<{ id: number; categoria: string }>('SELECT id, categoria FROM motivos');
  const tecnicos = await todos<{ id: number }>('SELECT id FROM tecnicos');
  const turnos = await todos<Turno>('SELECT id, hora_inicio, hora_fim FROM turnos WHERE ativo = 1');

  const SQL_OCORRENCIA = `INSERT INTO ocorrencias
      (maquina_id, motivo_id, tecnico_id, turno_id, tipo, prioridade, status,
       descricao, solucao, parou_producao, aberto_em, atendido_em, fim_em,
       criado_em, atualizado_em)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

  const ocorrencias: InStatement[] = [];
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

    ocorrencias.push({
      sql: SQL_OCORRENCIA,
      args: [
        maquina.id,
        motivo.id,
        atendidoEm ? sortear(tecnicos).id : null,
        turnoDe(turnos, abertoEm),
        tipo,
        prioridade,
        status,
        sortear(DESCRICOES),
        fimEm ? sortear(SOLUCOES) : null,
        tipo === 'Preventiva' && Math.random() < 0.4 ? 0 : 1,
        abertoEm,
        atendidoEm,
        fimEm,
        agora(),
        agora(),
      ],
    });
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

    ocorrencias.push({
      sql: SQL_OCORRENCIA,
      args: [
        sortear(maquinas).id,
        sortear(motivos).id,
        atendidoEm ? sortear(tecnicos).id : null,
        turnoDe(turnos, abertoEm),
        'Corretiva',
        prioridade,
        status,
        sortear(DESCRICOES),
        null,
        1,
        abertoEm,
        atendidoEm,
        null,
        agora(),
        agora(),
      ],
    });
  }

  // Em lotes: mandar 186 comandos numa tacada so estoura o limite do Turso.
  const LOTE = 50;
  for (let i = 0; i < ocorrencias.length; i += LOTE) {
    await db.batch(ocorrencias.slice(i, i + LOTE), 'write');
  }
}

/* Execucao direta: npm run seed */
const esteArquivo = fileURLToPath(import.meta.url);
const chamado = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (chamado && path.resolve(esteArquivo) === chamado) {
  await migrar();
  await popularBaseDeExemplo();
  const linha = await um<{ n: number }>('SELECT COUNT(*) AS n FROM ocorrencias');
  console.log(`[seed] pronto - ${linha?.n ?? 0} ocorrencias no banco.`);
}
