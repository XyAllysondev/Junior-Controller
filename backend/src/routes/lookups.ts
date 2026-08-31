import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';

export const lookupsRouter = Router();

/* ---------------------------------------------------------------------
 * Configuracao das tabelas de cadastro.
 * Cada entrada define quais colunas o cliente pode gravar, o schema de
 * validacao e como checar se o registro esta em uso antes de excluir.
 * ------------------------------------------------------------------ */
type Config = {
  tabela: string;
  colunas: string[];
  schema: z.ZodObject<any>;
  ordem: string;
  emUso?: string; // SQL que conta referencias; recebe o id como parametro
  rotulo: string;
};

const ativo = z.coerce.number().int().min(0).max(1).default(1);
const texto = (min = 1, max = 120) => z.string().trim().min(min).max(max);

const CONFIGS: Record<string, Config> = {
  setores: {
    tabela: 'setores',
    rotulo: 'Setor',
    colunas: ['nome', 'ativo'],
    ordem: 'nome COLLATE NOCASE',
    schema: z.object({ nome: texto(2), ativo }),
    emUso: 'SELECT COUNT(*) AS n FROM maquinas WHERE setor_id = ?',
  },
  maquinas: {
    tabela: 'maquinas',
    rotulo: 'Maquina',
    colunas: ['codigo', 'nome', 'setor_id', 'criticidade', 'ativo'],
    ordem: 'codigo COLLATE NOCASE',
    schema: z.object({
      codigo: texto(1, 30),
      nome: texto(2),
      setor_id: z.coerce.number().int().positive().nullable().optional(),
      criticidade: z.enum(['Baixa', 'Media', 'Alta']).default('Media'),
      ativo,
    }),
    emUso: 'SELECT COUNT(*) AS n FROM ocorrencias WHERE maquina_id = ?',
  },
  motivos: {
    tabela: 'motivos',
    rotulo: 'Motivo',
    colunas: ['nome', 'categoria', 'ativo'],
    ordem: 'categoria, nome COLLATE NOCASE',
    schema: z.object({
      nome: texto(2),
      categoria: z
        .enum([
          'Mecanica',
          'Eletrica',
          'Hidraulica',
          'Pneumatica',
          'Automacao',
          'Operacional',
          'Qualidade',
          'Setup',
          'Outros',
        ])
        .default('Mecanica'),
      ativo,
    }),
    emUso: 'SELECT COUNT(*) AS n FROM ocorrencias WHERE motivo_id = ?',
  },
  tecnicos: {
    tabela: 'tecnicos',
    rotulo: 'Tecnico',
    colunas: ['nome', 'matricula', 'especialidade', 'ativo'],
    ordem: 'nome COLLATE NOCASE',
    schema: z.object({
      nome: texto(2),
      matricula: z.string().trim().max(30).nullable().optional(),
      especialidade: z.string().trim().max(60).nullable().optional(),
      ativo,
    }),
    emUso: 'SELECT COUNT(*) AS n FROM ocorrencias WHERE tecnico_id = ?',
  },
  turnos: {
    tabela: 'turnos',
    rotulo: 'Turno',
    colunas: ['nome', 'hora_inicio', 'hora_fim', 'ativo'],
    ordem: 'hora_inicio',
    schema: z.object({
      nome: texto(1, 40),
      hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Use o formato HH:MM'),
      hora_fim: z.string().regex(/^\d{2}:\d{2}$/, 'Use o formato HH:MM'),
      ativo,
    }),
    emUso: 'SELECT COUNT(*) AS n FROM ocorrencias WHERE turno_id = ?',
  },
};

function pegarConfig(nome: string): Config | null {
  return Object.prototype.hasOwnProperty.call(CONFIGS, nome) ? CONFIGS[nome] : null;
}

function listar(cfg: Config, somenteAtivos = false) {
  const filtro = somenteAtivos ? 'WHERE ativo = 1' : '';
  return db.prepare(`SELECT * FROM ${cfg.tabela} ${filtro} ORDER BY ${cfg.ordem}`).all();
}

/* GET /api/lookups -> todos os cadastros de uma vez (usado pelos formularios) */
lookupsRouter.get('/', (req, res) => {
  const somenteAtivos = req.query.ativos === '1';
  const saida: Record<string, unknown> = {};
  for (const [chave, cfg] of Object.entries(CONFIGS)) {
    saida[chave] = listar(cfg, somenteAtivos);
  }
  res.json(saida);
});

/* GET /api/lookups/:tabela */
lookupsRouter.get('/:tabela', (req, res) => {
  const cfg = pegarConfig(req.params.tabela);
  if (!cfg) return res.status(404).json({ erro: 'Cadastro nao encontrado' });
  res.json(listar(cfg, req.query.ativos === '1'));
});

/* POST /api/lookups/:tabela */
lookupsRouter.post('/:tabela', (req, res) => {
  const cfg = pegarConfig(req.params.tabela);
  if (!cfg) return res.status(404).json({ erro: 'Cadastro nao encontrado' });

  const parsed = cfg.schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ erro: 'Dados invalidos', detalhes: parsed.error.flatten().fieldErrors });
  }

  const dados = parsed.data as Record<string, unknown>;
  const cols = cfg.colunas.filter((c) => dados[c] !== undefined);
  const sql = `INSERT INTO ${cfg.tabela} (${cols.join(', ')}) VALUES (${cols
    .map(() => '?')
    .join(', ')})`;

  try {
    const info = db.prepare(sql).run(...cols.map((c) => dados[c] ?? null));
    const criado = db.prepare(`SELECT * FROM ${cfg.tabela} WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json(criado);
  } catch (err) {
    const msg = String((err as Error).message);
    if (msg.includes('UNIQUE')) {
      return res.status(409).json({ erro: `${cfg.rotulo} ja cadastrado com esse nome/codigo.` });
    }
    throw err;
  }
});

/* PUT /api/lookups/:tabela/:id */
lookupsRouter.put('/:tabela/:id', (req, res) => {
  const cfg = pegarConfig(req.params.tabela);
  if (!cfg) return res.status(404).json({ erro: 'Cadastro nao encontrado' });

  const atual = db.prepare(`SELECT * FROM ${cfg.tabela} WHERE id = ?`).get(req.params.id);
  if (!atual) return res.status(404).json({ erro: `${cfg.rotulo} nao encontrado` });

  const parsed = cfg.schema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ erro: 'Dados invalidos', detalhes: parsed.error.flatten().fieldErrors });
  }

  const dados = parsed.data as Record<string, unknown>;
  const cols = cfg.colunas.filter((c) => dados[c] !== undefined);
  if (cols.length === 0) return res.json(atual);

  try {
    db.prepare(`UPDATE ${cfg.tabela} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
      .run(...cols.map((c) => dados[c] ?? null), req.params.id);
    res.json(db.prepare(`SELECT * FROM ${cfg.tabela} WHERE id = ?`).get(req.params.id));
  } catch (err) {
    const msg = String((err as Error).message);
    if (msg.includes('UNIQUE')) {
      return res
        .status(409)
        .json({ erro: `Ja existe outro ${cfg.rotulo.toLowerCase()} com esse nome/codigo.` });
    }
    throw err;
  }
});

/* DELETE /api/lookups/:tabela/:id
 * Se o registro ja foi usado em alguma ocorrencia, nao apaga: apenas
 * inativa, para nao perder o historico. */
lookupsRouter.delete('/:tabela/:id', (req, res) => {
  const cfg = pegarConfig(req.params.tabela);
  if (!cfg) return res.status(404).json({ erro: 'Cadastro nao encontrado' });

  const atual = db.prepare(`SELECT * FROM ${cfg.tabela} WHERE id = ?`).get(req.params.id);
  if (!atual) return res.status(404).json({ erro: `${cfg.rotulo} nao encontrado` });

  const usos = cfg.emUso
    ? (db.prepare(cfg.emUso).get(req.params.id) as { n: number }).n ?? 0
    : 0;

  if (usos > 0) {
    db.prepare(`UPDATE ${cfg.tabela} SET ativo = 0 WHERE id = ?`).run(req.params.id);
    return res.json({
      ok: true,
      inativado: true,
      mensagem: `Este registro aparece em ${usos} lancamento(s). Foi inativado em vez de excluido, para o historico e os indicadores continuarem corretos.`,
    });
  }

  db.prepare(`DELETE FROM ${cfg.tabela} WHERE id = ?`).run(req.params.id);
  res.json({ ok: true, inativado: false, mensagem: `${cfg.rotulo} excluido.` });
});
