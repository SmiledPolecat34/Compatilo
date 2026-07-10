export type IdentityDisplayMode = 'FIRST_NAME' | 'NICKNAME' | 'BOTH' | 'NONE';

/** Nom affiché à l'invité pour un participant, selon le réglage de la session. */
export function computeDisplayName(
  mode: IdentityDisplayMode,
  firstName: string,
  nickname: string | null,
  slot: number,
): string {
  switch (mode) {
    case 'FIRST_NAME':
      return firstName;
    case 'NICKNAME':
      return nickname || firstName;
    case 'NONE':
      return `Participant ${slot}`;
    case 'BOTH':
    default:
      return nickname ? `${firstName} « ${nickname} »` : firstName;
  }
}
