import type { NextFunction, Request, Response } from 'express';

/**
 * O Express 4 nao captura promessas rejeitadas: sem isso, um erro dentro
 * de um handler async deixaria a requisicao pendurada ate dar timeout.
 * Envolver o handler encaminha o erro para o tratador central.
 */
export const rota =
  (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
