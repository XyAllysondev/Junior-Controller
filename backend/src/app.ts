import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';

import { emServerless, migrar, ROOT, um, usandoTurso } from './db.js';
import { lookupsRouter } from './routes/lookups.js';
import { ocorrenciasRouter } from './routes/ocorrencias.js';
import { taRouter } from './routes/ta.js';
import { indicadoresRouter } from './routes/indicadores.js';


/* ---------------------------------------------------------------------
 * Preparo do banco
 *
 * Em serverless nao existe "subida do servidor": a funcao acorda a cada
 * requisicao. Por isso o preparo e preguicoso e memorizado - roda uma vez
 * por instancia e as demais requisicoes so aguardam a mesma promessa.
 * ------------------------------------------------------------------ */
let preparo: Promise<void> | null = null;

function prepararBanco(): Promise<void> {
  preparo ??= (async () => {
    if (process.env.AUTO_MIGRATE !== 'false') {
      await migrar();
    }
    if (process.env.SEED_ON_EMPTY !== 'false') {
      const linha = await um<{ n: number }>('SELECT COUNT(*) AS n FROM maquinas');
      if ((linha?.n ?? 0) === 0) {
        const { popularBaseDeExemplo } = await import('./seed.js');
        await popularBaseDeExemplo();
        console.log('[db] banco vazio -> dados de exemplo carregados');
      }
    }
  })().catch((err) => {
    // Nao deixa o erro grudado: a proxima requisicao tenta de novo.
    preparo = null;
    throw err;
  });

  return preparo;
}

export const app = express();

const origens = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: origens.length ? origens : true }));
app.use(express.json({ limit: '1mb' }));

// Log simples de requisicoes, util para acompanhar no terminal
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${new Date().toISOString()}  ${req.method} ${req.originalUrl}`);
  }
  next();
});

/* Diagnostico. Fica ANTES do preparo do banco de proposito: quando algo
   esta errado na configuracao, esta e a rota que ainda responde e conta
   o que o servidor esta enxergando. */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    servico: 'API Controle de Manutencao',
    versao: '1.1.0',
    banco: usandoTurso ? 'turso' : emServerless ? 'NAO CONFIGURADO' : 'arquivo local',
    serverless: emServerless,
    fuso_horario: process.env.FUSO_HORARIO ?? '-3 (padrao)',
    hora_servidor: new Date().toISOString(),
  });
});

// Garante o banco pronto antes das demais rotas da API
app.use('/api', (_req, _res, next) => {
  prepararBanco().then(() => next(), next);
});

app.use('/api/lookups', lookupsRouter);
app.use('/api/ocorrencias', ocorrenciasRouter);
app.use('/api/ta', taRouter);
app.use('/api/indicadores', indicadoresRouter);

/* ---------------------------------------------------------------------
 * Frontend compilado - usado quando tudo roda num processo so (local ou
 * numa VPS). Na Vercel quem serve a interface e a CDN, entao este bloco
 * simplesmente nao encontra a pasta e fica de fora.
 * ------------------------------------------------------------------ */
const distFrontend = path.resolve(ROOT, '..', 'frontend', 'dist');
if (fs.existsSync(distFrontend)) {
  app.use(express.static(distFrontend));
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(distFrontend, 'index.html'));
  });
  console.log(`[web] servindo frontend de ${distFrontend}`);
}

/* 404 de API */
app.use('/api', (_req, res) => {
  res.status(404).json({ erro: 'Rota nao encontrada' });
});

/* Tratamento de erro central */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[erro]', err);

  // Falta de configuracao nao e defeito do servidor: e 503 e a mensagem
  // precisa aparecer mesmo em producao, senao vira um erro mudo.
  const configuracao = /nao configurad|FUSO_HORARIO invalido|Migracao .* nao encontrada/i.test(
    err.message,
  );
  if (configuracao) {
    return res.status(503).json({ erro: err.message });
  }

  res.status(500).json({
    erro: 'Erro interno no servidor',
    detalhe: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

export default app;
