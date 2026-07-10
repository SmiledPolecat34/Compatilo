import type { SessionStatus } from '../types';

const META: Record<SessionStatus, { label: string; dot: string; classes: string }> = {
  ACTIVE: { label: 'Ouverte', dot: '🟢', classes: 'bg-brand-100 text-brand-700' },
  COMPLETED: { label: 'En attente', dot: '🟡', classes: 'bg-amber-100 text-amber-700' },
  CLOSED: { label: 'Fermée', dot: '🔴', classes: 'bg-rose-100 text-rose-700' },
  ARCHIVED: { label: 'Archivée', dot: '⚪', classes: 'bg-slate-100 text-slate-500' },
};

export default function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const meta = META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.classes}`}>
      <span aria-hidden>{meta.dot}</span>
      {meta.label}
    </span>
  );
}
