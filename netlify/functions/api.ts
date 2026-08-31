/**
 * Ponto de entrada da API na Netlify.
 *
 * A Netlify roda funcoes no formato Lambda (event/context), e nao o
 * (req, res) que o Express espera. O serverless-http faz essa traducao.
 *
 * O netlify.toml redireciona /api/* para ca. Dependendo de como a
 * plataforma resolve o redirecionamento, o caminho pode chegar ja
 * reescrito como /.netlify/functions/api/... - entao devolvemos o
 * prefixo /api antes de entregar ao Express, que so conhece as rotas
 * originais. Se o caminho ja vier certo, a troca simplesmente nao ocorre.
 */
import serverless from 'serverless-http';
import app from '../../backend/src/app.js';

const PREFIXO_NETLIFY = '/.netlify/functions/api';

type EventoLambda = { path?: string; rawUrl?: string; [k: string]: unknown };

const executar = serverless(app);

export const handler = async (evento: EventoLambda, contexto: unknown) => {
  if (typeof evento.path === 'string' && evento.path.startsWith(PREFIXO_NETLIFY)) {
    evento.path = `/api${evento.path.slice(PREFIXO_NETLIFY.length)}`;
  }
  return executar(evento as never, contexto as never);
};
