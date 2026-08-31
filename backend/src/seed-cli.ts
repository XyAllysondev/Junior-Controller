import 'dotenv/config';
import { migrar, um } from './db.js';
import { popularBaseDeExemplo } from './seed.js';

/* ---------------------------------------------------------------------
 * Script de linha de comando: npm run seed
 *
 * A carga de exemplo mora em seed.ts, que e um modulo puro - sem
 * top-level await nem import.meta. Isso importa porque o app.ts importa
 * esse modulo, e ele acaba dentro do pacote da funcao serverless, que
 * pode ser gerado em CommonJS (onde os dois recursos nao existem).
 * ------------------------------------------------------------------ */
await migrar();
await popularBaseDeExemplo();

const linha = await um<{ n: number }>('SELECT COUNT(*) AS n FROM ocorrencias');
console.log(`[seed] pronto - ${linha?.n ?? 0} ocorrencias no banco.`);
