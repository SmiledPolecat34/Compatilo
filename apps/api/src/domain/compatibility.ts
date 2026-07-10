/**
 * Domaine — calcul de compatibilité.
 *
 * Règles produit :
 *   Oui / Oui            → compatible
 *   Possible / Possible  → compatible
 *   Non / Non            → compatible
 *   Oui / Possible       → compatible partielle
 *   Non / Possible       → compatible partielle
 *   Oui / Non            → différence
 *
 * « Possible » ne demande jamais d'accord : il reste visible mais
 * n'est jamais compté comme une différence.
 */

export type TrileanValue = 'YES' | 'POSSIBLE' | 'NO';
export type MatchKind = 'MATCH' | 'PARTIAL' | 'DIFFERENCE';

export function compareAnswers(a: TrileanValue, b: TrileanValue): MatchKind {
  if (a === b) return 'MATCH';
  if (a === 'POSSIBLE' || b === 'POSSIBLE') return 'PARTIAL';
  return 'DIFFERENCE';
}

const WEIGHTS: Record<MatchKind, number> = {
  MATCH: 1,
  PARTIAL: 0.5,
  DIFFERENCE: 0,
};

/** Score global en pourcentage sur les questions répondues par les deux. */
export function computeScore(kinds: MatchKind[]): number {
  if (kinds.length === 0) return 0;
  const total = kinds.reduce((sum, k) => sum + WEIGHTS[k], 0);
  return Math.round((total / kinds.length) * 100);
}

export function isTrilean(value: unknown): value is TrileanValue {
  return value === 'YES' || value === 'POSSIBLE' || value === 'NO';
}
