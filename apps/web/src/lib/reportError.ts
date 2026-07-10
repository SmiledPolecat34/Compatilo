import { apiUrl } from '../api/client';

type ErrorSource = 'error_boundary' | 'window_error' | 'unhandled_rejection';

/** Envoie une erreur front au serveur pour visibilité côté logs (best-effort). */
export function reportClientError(message: string, stack?: string, source: ErrorSource = 'window_error') {
  try {
    const body = JSON.stringify({ message: message.slice(0, 2000), stack, url: location.href, source });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(apiUrl('/api/public/client-errors'), new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(apiUrl('/api/public/client-errors'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // La remontée d'erreur ne doit jamais elle-même faire planter l'app
  }
}

let installed = false;

/** Capture les erreurs non interceptées par React (scripts, promesses). */
export function installGlobalErrorReporting() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (event) => {
    reportClientError(event.message, event.error?.stack, 'window_error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    reportClientError(message, reason instanceof Error ? reason.stack : undefined, 'unhandled_rejection');
  });
}
