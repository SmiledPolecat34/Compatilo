import { useEffect } from 'react';

/**
 * Verrouille le scroll du body pendant qu'une modale est ouverte.
 * Sans ça, sur iOS Safari, le focus d'un champ à l'intérieur d'une modale
 * en `position: fixed` fait défiler la page derrière et décale la modale
 * (l'en-tête sort du viewport pendant la saisie).
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { body } = document;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
