/**
 * Ponto de entrada da API na Vercel.
 *
 * O nome do arquivo e um "catch-all" opcional: tudo que chega em /api e
 * em /api/qualquer/coisa cai aqui, e o proprio Express faz o roteamento
 * a partir da URL original.
 *
 * Um app Express e, na pratica, uma funcao (req, res) - que e exatamente
 * o que o runtime da Vercel espera.
 */
import app from '../backend/src/app.js';

export default app;
