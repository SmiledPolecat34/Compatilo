import { forwardRef, type ReactNode } from 'react';
import type { ReportData } from '../../types';
import {
  IconCalendar,
  IconCheck,
  IconChat,
  IconHeart,
  IconHome,
  IconPen,
  IconScale,
  IconShield,
  IconSparkles,
  IconStar,
  IconUser,
  IconUsers,
} from '../icons/ContractIcons';

export interface ContractViewProps {
  contractNumber: string;
  score: number;
  generatedAt: string;
  data: ReportData;
  signatures: { participantId: string; image: string; signedAt: string }[];
  myParticipantId?: string;
}

const THEME_ICONS = [IconHeart, IconChat, IconHome, IconScale, IconStar, IconShield];
const INK = '#241a3a';
const MUTED = '#8a7fa8';
const BORDER = '#ece3fb';
const PANEL = '#faf7ff';
const ACCENT = '#7c4fe0';

function scoreQuote(score: number): string {
  if (score >= 85) {
    return 'Une connexion forte, basée sur la compréhension, la confiance et l’envie d’avancer ensemble.';
  }
  if (score >= 70) {
    return 'Une belle harmonie, portée par de nombreux points communs et une vraie envie de se comprendre.';
  }
  if (score >= 50) {
    return 'Un socle commun réel, avec des différences qui méritent d’être discutées à cœur ouvert.';
  }
  return 'Des différences marquées, mais autant d’occasions sincères de mieux se découvrir.';
}

/**
 * Rendu figé (couleurs fixes, indépendant du thème du site) destiné à
 * l'export PNG/PDF — la mise en page doit rester identique à chaque
 * génération, seuls les noms, réponses et signatures changent.
 */
const ContractView = forwardRef<HTMLDivElement, ContractViewProps>(function ContractView(
  { contractNumber, score, generatedAt, data, signatures, myParticipantId },
  ref,
) {
  const participants = data.participants;
  const meIndex = participants.findIndex((p) => p.id === myParticipantId);
  const meKnown = meIndex >= 0;
  const me = meKnown ? participants[meIndex] : participants[0];
  const other = participants.find((p) => p.id !== me?.id) ?? participants[1];
  const meLabel = meKnown ? 'Moi' : 'Participant 1';
  const otherLabel = meKnown ? 'L’autre personne' : 'Participant 2';
  const date = new Date(generatedAt);

  // Le contrat ne montre que "ce qui est possible entre nous" : uniquement
  // les questions trilean (Oui/Possible/Non), pas les attributs factuels
  // (permis, cuisine, équipement…) qui vivent dans d'autres pages.
  const themedPages = data.pages
    .map((p) => ({
      ...p,
      results: p.results.filter((r) => r.questionType === 'trilean' && r.kind !== null),
    }))
    .filter((p) => p.results.length > 0);
  const themeCards = themedPages.map((p, i) => {
    const possible = p.results.filter((r) => r.valueA !== 'NO' && r.valueB !== 'NO');
    return {
      title: p.title,
      Icon: THEME_ICONS[i % THEME_ICONS.length],
      items: possible.slice(0, 4).map((r) => r.prompt),
    };
  });

  const checklist = data.tags.slice(0, 4);

  function sigFor(participantId: string | undefined) {
    return signatures.find((s) => s.participantId === participantId) ?? null;
  }

  return (
    <div
      ref={ref}
      style={{
        width: 1040,
        fontFamily: '"Fraunces", Georgia, serif',
        background: 'linear-gradient(160deg, #f5f0ff 0%, #fbeff5 55%, #f5f0ff 100%)',
        color: INK,
        padding: 48,
        border: `1px solid ${BORDER}`,
        borderRadius: 32,
        boxSizing: 'border-box',
      }}
    >
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="" width={44} height={44} style={{ borderRadius: 14 }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: INK }}>Compatilo</div>
            <div style={{ fontSize: 12, color: MUTED, fontFamily: 'sans-serif' }}>
              Découvre ta compatibilité
            </div>
          </div>
        </div>
        <Pill>
          <IconCalendar size={14} />
          {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </Pill>
      </div>

      {/* Titre */}
      <div style={{ textAlign: 'center', marginTop: 36 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: `1px solid #d9cdf5`,
            borderRadius: 999,
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
            color: ACCENT,
            fontFamily: 'sans-serif',
          }}
        >
          <IconSparkles size={13} /> CONTRAT DE COMPATIBILITÉ
        </span>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: '16px 0 8px', color: INK }}>
          Notre accord de compatibilité
        </h1>
        <p style={{ color: '#7a6f97', fontSize: 14, fontFamily: 'sans-serif', maxWidth: 640, margin: '0 auto' }}>
          Un contrat basé sur nos réponses et nos envies, pour construire une relation claire,
          respectueuse et authentique.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e0d5f7' }} />
          <IconHeart size={16} style={{ color: ACCENT }} />
          <div style={{ flex: 1, height: 1, background: '#e0d5f7' }} />
        </div>
        <Pill>Contrat n° {contractNumber}</Pill>
      </div>

      {/* Parties + score global */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 32 }}>
        <Panel>
          <SectionLabel Icon={IconUsers}>Les parties</SectionLabel>
          <PartyRow label={meLabel} name={me?.firstName ?? '—'} nickname={me?.nickname} />
          <div style={{ height: 1, background: BORDER, margin: '14px 0' }} />
          <PartyRow label={otherLabel} name={other?.firstName ?? '—'} nickname={other?.nickname} />
        </Panel>

        <Panel>
          <SectionLabel Icon={IconHeart}>Notre compatibilité globale</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 8 }}>
            <MiniDonut score={score} />
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13, fontFamily: 'sans-serif' }}>
              {checklist.map((tag) => (
                <li key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#3d3060' }}>
                  <IconCheck size={13} style={{ color: '#4cb782', flexShrink: 0 }} /> {tag}
                </li>
              ))}
            </ul>
          </div>
          <p
            style={{
              marginTop: 16,
              fontStyle: 'italic',
              fontSize: 13,
              color: '#5b4a8a',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            “ {scoreQuote(score)} ”
          </p>
        </Panel>
      </div>

      {/* Ce qui est possible entre nous */}
      <div style={{ marginTop: 32 }}>
        <SectionLabel Icon={IconSparkles}>Ce qui est possible entre nous</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 12 }}>
          {themeCards.map((card) => (
            <div key={card.title} style={{ background: PANEL, borderRadius: 18, padding: 18, border: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: '#ede4fc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: ACCENT,
                    flexShrink: 0,
                  }}
                >
                  <card.Icon size={17} />
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, color: INK }}>{card.title}</span>
              </div>
              <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', fontSize: 12.5, fontFamily: 'sans-serif' }}>
                {card.items.length === 0 && (
                  <li style={{ color: '#a89bc9' }}>Pas de correspondance nette.</li>
                )}
                {card.items.map((item) => (
                  <li key={item} style={{ display: 'flex', gap: 6, marginBottom: 6, color: '#4a3d70' }}>
                    <IconCheck size={13} style={{ color: '#4cb782', flexShrink: 0, marginTop: 2 }} /> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement mutuel */}
      <div
        style={{
          marginTop: 32,
          background: 'linear-gradient(120deg,#efe6fd,#fbe9f1)',
          borderRadius: 20,
          padding: 22,
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }}>
          <IconShield size={24} />
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: INK }}>Notre engagement mutuel</div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#5b4a8a', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
            Nous nous engageons à respecter ce qui a été défini ensemble, à communiquer avec
            sincérité, et à faire de cette relation quelque chose de sain, durable et
            épanouissant.
          </p>
        </div>
      </div>

      {/* Signatures */}
      <div style={{ marginTop: 32 }}>
        <SectionLabel Icon={IconPen}>Signatures</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 12 }}>
          {[me, other].map((p) => {
            const sig = p ? sigFor(p.id) : null;
            return (
              <div
                key={p?.id ?? Math.random()}
                style={{ border: `1px solid ${BORDER}`, borderRadius: 18, padding: 18, textAlign: 'center' }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: INK }}>
                  {p?.firstName ?? '—'} {p?.nickname && `(${p.nickname})`}
                </div>
                <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                  {sig ? (
                    <img src={sig.image} alt="" style={{ height: 70, objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 12, color: '#a89bc9', fontFamily: 'sans-serif' }}>
                      En attente de signature…
                    </span>
                  )}
                </div>
                <div
                  style={{
                    borderTop: `1px solid ${BORDER}`,
                    marginTop: 8,
                    paddingTop: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: '#a89bc9',
                    fontFamily: 'sans-serif',
                  }}
                >
                  <span>Signature</span>
                  <span>{sig ? new Date(sig.signedAt).toLocaleDateString('fr-FR') : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pied */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          textAlign: 'center',
          marginTop: 28,
          fontSize: 11,
          color: '#a89bc9',
          fontFamily: 'sans-serif',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconLockSmall /> Ce contrat est symbolique et n’a pas de valeur juridique.
        </span>
        <span>Il représente notre accord et notre engagement mutuel.</span>
      </div>
    </div>
  );
});

export default ContractView;

function IconLockSmall() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </svg>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: '1px solid #d9cdf5',
        borderRadius: 999,
        padding: '8px 16px',
        fontSize: 13,
        color: '#5b4a8a',
        fontFamily: 'sans-serif',
      }}
    >
      {children}
    </span>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: PANEL, borderRadius: 20, padding: 24, border: `1px solid ${BORDER}` }}>{children}</div>
  );
}

function SectionLabel({
  Icon,
  children,
}: {
  Icon: (props: { size?: number }) => ReactNode;
  children: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: INK }}>
      <span style={{ color: ACCENT, display: 'flex' }}>
        <Icon size={17} />
      </span>
      {children}
    </div>
  );
}

function PartyRow({ label, name, nickname }: { label: string; name: string; nickname?: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: '#ede4fc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: ACCENT,
          flexShrink: 0,
        }}
      >
        <IconUser size={18} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: MUTED, fontFamily: 'sans-serif' }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: INK }}>
          {name}
          {nickname && <span style={{ fontWeight: 500, color: MUTED }}> ({nickname})</span>}
        </div>
      </div>
    </div>
  );
}

function MiniDonut({ score }: { score: number }) {
  const size = 96;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={BORDER} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#8f54ec"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 20, fontWeight: 800, fill: INK }}>
        {score}%
      </text>
      <text x="50%" y="66%" textAnchor="middle" style={{ fontSize: 9, fill: MUTED, fontFamily: 'sans-serif' }}>
        Compatibilité
      </text>
    </svg>
  );
}
