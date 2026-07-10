export type TrileanValue = 'YES' | 'POSSIBLE' | 'NO';
export type MatchKind = 'MATCH' | 'PARTIAL' | 'DIFFERENCE';

export interface QuestionDto {
  id: string;
  type: string;
  prompt: string;
  helpText: string | null;
  required: boolean;
  config: Record<string, unknown>;
}

export interface PageDto {
  id: string;
  title: string;
  description: string | null;
  questions: QuestionDto[];
}

export interface QuestionnairePayload {
  questionnaire: { title: string; description: string | null; pages: PageDto[] };
  participant: { firstName: string; slot: number; completed: boolean };
  answers: Record<string, TrileanValue>;
  favorites: string[];
  favoritesRule: { min: number; max: number };
}

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

export interface ReportData {
  session: { publicId: string; label: string | null };
  participants: {
    id: string;
    slot: number;
    firstName: string;
    nickname: string | null;
    city: string | null;
    completedAt: string;
    favorites: string[];
  }[];
  score: number;
  counts: { match: number; partial: number; difference: number; total: number };
  pages: PageResult[];
  tags: string[];
  summary: string;
}

export interface ReportPayload {
  ready: boolean;
  waitingFor?: string[];
  report?: {
    code: string;
    score: number;
    generatedAt: string;
    data: ReportData;
    signatures: { participantId: string; image: string; signedAt: string }[];
    myParticipantId: string;
  };
}

// ── Admin ──────────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  publicId: string;
  label: string | null;
  status: string;
  reportAccessEnabled: boolean;
  expiresAt: string | null;
  createdAt: string;
  questionnaire: string;
  participants: { slot: number; firstName: string; nickname: string | null; completed: boolean }[];
  report: { code: string; score: number } | null;
}

export interface SessionDetail {
  id: string;
  publicId: string;
  label: string | null;
  status: string;
  reportAccessEnabled: boolean;
  expiresAt: string | null;
  privateNotes: string | null;
  createdAt: string;
  questionnaire: string;
  totalQuestions: number;
  participants: {
    id: string;
    slot: number;
    firstName: string;
    nickname: string | null;
    joinedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    answeredCount: number;
    favoritesCount: number;
    locationConsent: boolean;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  }[];
  report: {
    code: string;
    score: number;
    generatedAt: string;
    data: ReportData;
    signatures: { participantId: string; image: string; signedAt: string }[];
  } | null;
}

export interface TimelineEvent {
  id: string;
  type: string;
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface QuestionnaireListItem {
  id: string;
  title: string;
  description: string | null;
  updatedAt: string;
  versions: { id: string; version: number; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; publishedAt: string | null }[];
}

export interface EditorQuestion {
  id?: string;
  localId: string;
  type: string;
  prompt: string;
  helpText?: string | null;
  isActive: boolean;
  required: boolean;
  config: Record<string, unknown>;
}

export interface EditorPage {
  id?: string;
  localId: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  questions: EditorQuestion[];
}
