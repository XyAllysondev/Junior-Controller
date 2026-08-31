import 'dotenv/config';
import app from './app.js';

/* ---------------------------------------------------------------------
 * Subida local (npm run dev / npm start).
 * Na Vercel este arquivo nao e usado: a funcao em api/ importa o app
 * diretamente, sem abrir porta.
 * ------------------------------------------------------------------ */
const PORT = Number(process.env.PORT) || 3333;

app.listen(PORT, () => {
  console.log('');
  console.log('  Controle de Manutencao - API no ar');
  console.log(`  http://localhost:${PORT}/api/health`);
  console.log('');
});
