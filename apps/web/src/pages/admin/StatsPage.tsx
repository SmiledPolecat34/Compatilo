import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../components/ToastProvider';

interface Stats {
  sessions: { total: number; active: number; completed: number; archived: number };
  participants: { total: number; completed: number };
  reports: { total: number; averageScore: number | null };
  questionnaires: { total: number; publishedVersions: number };
  music: { playlists: number; tracks: number };
}

export default function StatsPage() {
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>('/api/admin/stats', { auth: 'admin' })
      .then(setStats)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Chargement impossible.'));
  }, [toast]);

  if (!stats) {
    return (
      <div className="animate-fade-up">
        <h1 className="mb-6 font-display text-3xl font-bold text-brand-900">Statistiques</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const cards: { label: string; value: string | number; hint?: string }[] = [
    { label: 'Sessions créées', value: stats.sessions.total },
    { label: 'Sessions actives', value: stats.sessions.active },
    { label: 'Sessions terminées', value: stats.sessions.completed },
    { label: 'Sessions archivées', value: stats.sessions.archived },
    { label: 'Participants', value: stats.participants.total, hint: `${stats.participants.completed} ont terminé` },
    {
      label: 'Rapports générés',
      value: stats.reports.total,
      hint: stats.reports.averageScore !== null ? `Score moyen : ${stats.reports.averageScore}%` : undefined,
    },
    { label: 'Questionnaires', value: stats.questionnaires.total, hint: `${stats.questionnaires.publishedVersions} version(s) publiée(s)` },
    { label: 'Playlists', value: stats.music.playlists, hint: `${stats.music.tracks} piste(s)` },
  ];

  return (
    <div className="animate-fade-up">
      <h1 className="mb-6 font-display text-3xl font-bold text-brand-900">Statistiques</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-sm font-medium text-slate-500">{c.label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-brand-900">{c.value}</p>
            {c.hint && <p className="mt-1 text-xs text-slate-500">{c.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
