/** Client HTTP minimal avec gestion des jetons admin / participant. */

const API_BASE = import.meta.env.VITE_API_URL ?? '';

/** URL absolue vers une ressource servie par l'API (ex. fichier audio). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

type TokenKind = 'admin' | 'participant';

const storageKey = (kind: TokenKind) => `compatilo_${kind}_token`;

export const tokens = {
  get: (kind: TokenKind) => sessionStorage.getItem(storageKey(kind)),
  set: (kind: TokenKind, token: string) => sessionStorage.setItem(storageKey(kind), token),
  clear: (kind: TokenKind) => sessionStorage.removeItem(storageKey(kind)),
};

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: TokenKind;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth) {
    const token = tokens.get(options.auth);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? 'Une erreur est survenue.', data.code);
  }
  return data as T;
}

/** Upload multipart (ex. fichier audio) — auth admin uniquement pour l'instant. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokens.get('admin');
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? 'Une erreur est survenue.', data.code);
  }
  return data as T;
}
