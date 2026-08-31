import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';

import { ROOT, db, migrate } from './db.js';
import { lookupsRouter } from './routes/lookups.js';
import { ocorrenciasRouter } from './routes/ocorrencias.js';
import { taRouter } from './routes/ta.js';
import { indicadoresRouter } from './routes/indicadores.js';
import { popularBaseDeExemplo } from './seed.js';

const PORT = Number(process.env.PORT) || 3333;

/* ------------------------------------------------------------------ */
/* Banco                                                               */
/* ------------------------------------------------------------------ */
if (process.env.AUTO_MIGRATE !== 'false') {
  migrate();
}

if (process.env.SEED_ON_EMPTY !== 'false') {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM maquinas').get() as { n: number };
  if (n === 0) {
    popularBaseDeExemplo();
    console.log('[db] banco vazio -> dados de exemplo carregados');
  }
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */
const app = express();

const origens = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origens.length ? origens : true,
  }),
);
app.use(express.json({ limit: '1mb' }));

// Log simples de requisicoes, util para acompanhar no terminal
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${new Date().toLocaleTimeString('pt-BR')}  ${req.method} ${req.originalUrl}`);
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    servico: 'API Controle de Manutencao',
    versao: '1.0.0',
    hora: new Date().toISOString(),
  });
});

app.use('/api/lookups', lookupsRouter);
app.use('/api/ocorrencias', ocorrenciasRouter);
app.use('/api/ta', taRouter);
app.use('/api/indicadores', indicadoresRouter);

/* ------------------------------------------------------------------ */
/* Frontend compilado (npm run build na pasta frontend/)               */
/* ------------------------------------------------------------------ */
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
  res.status(500).json({
    erro: 'Erro interno no servidor',
    detalhe: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  Controle de Manutencao - API no ar');
  console.log(`  http://localhost:${PORT}/api/health`);
  console.log('');
});
