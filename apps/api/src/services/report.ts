import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateReportCode } from '../lib/crypto.js';
import { logEvent } from './timeline.js';
import { computeDisplayName, type IdentityDisplayMode } from '../domain/identity.js';
import {
  compareAnswers,
  computeScore,
  isTrilean,
  type MatchKind,
  type TrileanValue,
} from '../domain/compatibility.js';

export interface QuestionResult {
  questionId: string;
  prompt: string;
  valueA: TrileanValue | null;
  valueB: TrileanValue | null;
  kind: MatchKind | null;
  isFavoriteA: boolean;
  isFavoriteB: boolean;
}

export interface PageResult {
  pageId: string;
  title: string;
  score: number;
  results: QuestionResult[];
}

export interface ReportParticipant {
  id: string;
  slot: number;
  firstName: string;
  nickname: string | null;
  city: string | null;
  completedAt: Date | string;
  favorites: string[];
}

export interface ReportData {
  session: { publicId: string; label: string | null };
  participants: ReportParticipant[];
  score: number;
  counts: { match: number; partial: number; difference: number; total: number };
  pages: PageResult[];
  tags: string[];
  summary: string;
}

/** Génère le rapport quand les deux participants ont terminé. Idempotent. */
export async function generateReport(sessionId: string) {
  const existing = await prisma.report.findUnique({ where: { sessionId } });
  if (existing) return existing;

  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      participants: {
        orderBy: { slot: 'asc' },
        include: { answers: true, favorites: true },
      },
      version: {
        include: {
          pages: {
            where: { isActive: true },
            orderBy: { position: 'asc' },
            include: { questions: { where: { isActive: true }, orderBy: { position: 'asc' } } },
          },
        },
      },
    },
  });

  const [a, b] = session.participants;
  if (!a?.completedAt || !b?.completedAt) return null;

  const answersA = new Map(a.answers.map((x) => [x.questionId, x.value]));
  const answersB = new Map(b.answers.map((x) => [x.questionId, x.value]));
  const favA = new Set(a.favorites.map((x) => x.questionId));
  const favB = new Set(b.favorites.map((x) => x.questionId));

  const pages: PageResult[] = [];
  const allKinds: MatchKind[] = [];

  for (const page of session.version.pages) {
    const results: QuestionResult[] = [];
    const pageKinds: MatchKind[] = [];
    for (const q of page.questions) {
      const rawA = answersA.get(q.id);
      const rawB = answersB.get(q.id);
      const vA = isTrilean(rawA) ? rawA : null;
      const vB = isTrilean(rawB) ? rawB : null;
      const kind = vA && vB ? compareAnswers(vA, vB) : null;
      if (kind) {
        pageKinds.push(kind);
        allKinds.push(kind);
      }
      results.push({
        questionId: q.id,
        prompt: q.prompt,
        valueA: vA,
        valueB: vB,
        kind,
        isFavoriteA: favA.has(q.id),
        isFavoriteB: favB.has(q.id),
      });
    }
    if (results.length > 0) {
      pages.push({ pageId: page.id, title: page.title, score: computeScore(pageKinds), results });
    }
  }

  const score = computeScore(allKinds);
  const counts = {
    match: allKinds.filter((k) => k === 'MATCH').length,
    partial: allKinds.filter((k) => k === 'PARTIAL').length,
    difference: allKinds.filter((k) => k === 'DIFFERENCE').length,
    total: allKinds.length,
  };

  const sortedPages = [...pages].sort((x, y) => y.score - x.score);
  const tags = buildTags(score, sortedPages);
  const summary = buildSummary(a.firstName, b.firstName, score, counts, sortedPages);

  const data = {
    session: { publicId: session.publicId, label: session.label },
    participants: session.participants.map((p) => ({
      id: p.id,
      slot: p.slot,
      firstName: p.firstName,
      nickname: p.nickname,
      city: p.locationConsent ? p.city : null,
      completedAt: p.completedAt,
      favorites: p.favorites.map((f) => f.questionId),
    })),
    score,
    counts,
    pages,
    tags,
    summary,
  };

  const report = await prisma.report.create({
    data: {
      sessionId,
      code: generateReportCode(),
      score,
      data: data as unknown as Prisma.InputJsonValue,
    },
  });
  await prisma.session.update({ where: { id: sessionId }, data: { status: 'COMPLETED' } });
  await logEvent(sessionId, 'report.generated', `Rapport ${report.code} généré (score ${score}%)`, {
    code: report.code,
    score,
  });
  return report;
}

function buildTags(score: number, sortedPages: PageResult[]): string[] {
  const tags: string[] = [];
  if (score >= 85) tags.push('Duo très complice');
  else if (score >= 70) tags.push('Belle harmonie');
  else if (score >= 50) tags.push('Équilibre à construire');
  else tags.push('Opposés qui s’attirent');

  const best = sortedPages[0];
  const worst = sortedPages[sortedPages.length - 1];
  if (best && best.score >= 70) tags.push(`Alignés sur ${best.title.toLowerCase()}`);
  if (worst && worst !== best && worst.score < 50) {
    tags.push(`À explorer : ${worst.title.toLowerCase()}`);
  }
  return tags.slice(0, 4);
}

export function buildSummary(
  nameA: string,
  nameB: string,
  score: number,
  counts: { match: number; partial: number; difference: number; total: number },
  sortedPages: PageResult[],
): string {
  const best = sortedPages[0];
  const worst = sortedPages[sortedPages.length - 1];
  const parts: string[] = [];

  if (score >= 85) {
    parts.push(
      `${nameA} et ${nameB} affichent une compatibilité remarquable de ${score} %. Leurs visions se rejoignent sur l'essentiel.`,
    );
  } else if (score >= 70) {
    parts.push(
      `Avec ${score} % de compatibilité, ${nameA} et ${nameB} partagent une belle harmonie, portée par de nombreux points communs.`,
    );
  } else if (score >= 50) {
    parts.push(
      `${nameA} et ${nameB} obtiennent ${score} % de compatibilité : un socle commun réel, avec des différences qui méritent d'être discutées.`,
    );
  } else {
    parts.push(
      `${nameA} et ${nameB} obtiennent ${score} % de compatibilité. Leurs différences sont marquées — autant d'occasions de mieux se découvrir.`,
    );
  }

  parts.push(
    `Sur ${counts.total} questions comparées, ${counts.match} réponses concordent parfaitement, ${counts.partial} restent ouvertes et ${counts.difference} révèlent de vraies différences.`,
  );
  if (best) {
    parts.push(`C'est sur « ${best.title} » que le duo est le plus aligné (${best.score} %).`);
  }
  if (worst && worst !== best) {
    parts.push(
      `Le thème « ${worst.title} » (${worst.score} %) est celui qui gagnera le plus à être approfondi ensemble.`,
    );
  }
  return parts.join(' ');
}

/**
 * Vue invité du rapport : remplace l'identité réelle par le nom affiché
 * choisi par l'admin pour la session (l'instantané stocké garde toujours
 * les vraies données pour la vue admin). Le résumé est recalculé pour ne
 * jamais laisser fuiter un prénom réel masqué par le réglage.
 */
export function applyIdentityDisplay(data: ReportData, mode: IdentityDisplayMode): ReportData {
  const participants = data.participants.map((p) => ({
    ...p,
    firstName: computeDisplayName(mode, p.firstName, p.nickname, p.slot),
    nickname: null,
  }));
  const [a, b] = participants;
  const sortedPages = [...data.pages].sort((x, y) => y.score - x.score);
  const summary = a && b ? buildSummary(a.firstName, b.firstName, data.score, data.counts, sortedPages) : data.summary;
  return { ...data, participants, summary };
}
