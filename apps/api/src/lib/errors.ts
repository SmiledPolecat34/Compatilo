export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export const notFound = (msg = 'Ressource introuvable') => new HttpError(404, msg);
export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const unauthorized = (msg = 'Authentification requise') => new HttpError(401, msg);
export const forbidden = (msg = 'Accès refusé') => new HttpError(403, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
export const tooMany = (msg: string) => new HttpError(429, msg);
