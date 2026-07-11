import { forwardRef } from 'react';
import type { ReportData } from '../../types';

export interface ContractViewProps {
  contractNumber: string;
  score: number;
  generatedAt: string;
  data: ReportData;
  signatures: { participantId: string; image: string; signedAt: string }[];
  myParticipantId?: string;
}

const THEME_ICONS = ['💞', '💬', '🏠', '⚖️', '⭐', '🛡️', '🎯', '🌟'];

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
  const me = meIndex >= 0 ? participants[meIndex] : participants[0];
  const other = participants.find((p) => p.id !== me?.id) ?? participants[1];
  const date = new Date(generatedAt);

  const themedPages = data.pages.filter((p) => p.results.some((r) => r.kind !== null));
  const themeCards = themedPages.map((p, i) => {
    const possible = p.results.filter(
      (r) => r.kind !== null && r.valueA !== 'NO' && r.valueB !== 'NO',
    );
    return {
      title: p.title,
      icon: THEME_ICONS[i % THEME_ICONS.length],
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
        color: '#241a3a',
        padding: 48,
        border: '1px solid #e7defb',
        borderRadius: 32,
        boxSizing: 'border-box',
      }}
    >
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg,#8f54ec,#f45b8f)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            💘
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#241a3a' }}>Compatilo</div>
            <div style={{ fontSize: 12, color: '#8a7fa8', fontFamily: 'sans-serif' }}>
              Découvre ta compatibilité
            </div>
          </div>
        </div>
        <div
          style={{
            border: '1px solid #d9cdf5',
            borderRadius: 999,
            padding: '8px 16px',
            fontSize: 13,
            color: '#5b4a8a',
            fontFamily: 'sans-serif',
          }}
        >
          📅 {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Titre */}
      <div style={{ textAlign: 'center', marginTop: 36 }}>
        <span
          style={{
            display: 'inline-block',
            border: '1px solid #d9cdf5',
            borderRadius: 999,
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
            color: '#7c4fe0',
            fontFamily: 'sans-serif',
          }}
        >
          ◆ CONTRAT DE COMPATIBILITÉ
        </span>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: '16px 0 8px', color: '#241a3a' }}>
          Notre accord de compatibilité
        </h1>
        <p style={{ color: '#7a6f97', fontSize: 14, fontFamily: 'sans-serif', maxWidth: 640, margin: '0 auto' }}>
          Un contrat basé sur nos réponses et nos envies, pour construire une relation claire,
          respectueuse et authentique.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e0d5f7' }} />
          <span style={{ fontSize: 18 }}>💞</span>
          <div style={{ flex: 1, height: 1, background: '#e0d5f7' }} />
        </div>
        <span
          style={{
            display: 'inline-block',
            border: '1px solid #d9cdf5',
            borderRadius: 999,
            padding: '4px 14px',
            fontSize: 12,
            color: '#5b4a8a',
            fontFamily: 'sans-serif',
          }}
        >
          Contrat n° {contractNumber}
        </span>
      </div>

      {/* Parties + score global */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 32 }}>
        <div style={{ background: '#faf7ff', borderRadius: 20, padding: 24, border: '1px solid #ece3fb' }}>
          <SectionLabel icon="👥">Les parties</SectionLabel>
          <PartyRow label="Moi" name={me?.firstName ?? '—'} nickname={me?.nickname} />
          <div style={{ height: 1, background: '#ece3fb', margin: '14px 0' }} />
          <PartyRow label="L’autre personne" name={other?.firstName ?? '—'} nickname={other?.nickname} />
        </div>

        <div style={{ background: '#faf7ff', borderRadius: 20, padding: 24, border: '1px solid #ece3fb' }}>
          <SectionLabel icon="🤍">Notre compatibilité globale</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 8 }}>
            <MiniDonut score={score} />
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13, fontFamily: 'sans-serif' }}>
              {checklist.map((tag) => (
                <li key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#3d3060' }}>
                  <span style={{ color: '#4cb782' }}>✔</span> {tag}
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
        </div>
      </div>

      {/* Ce qui est possible entre nous */}
      <div style={{ marginTop: 32 }}>
        <SectionLabel icon="✨">Ce qui est possible entre nous</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 12 }}>
          {themeCards.map((card) => (
            <div
              key={card.title}
              style={{ background: '#faf7ff', borderRadius: 18, padding: 18, border: '1px solid #ece3fb' }}
            >
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
                    fontSize: 16,
                  }}
                >
                  {card.icon}
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#241a3a' }}>{card.title}</span>
              </div>
              <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', fontSize: 12.5, fontFamily: 'sans-serif' }}>
                {card.items.length === 0 && (
                  <li style={{ color: '#a89bc9' }}>Pas de correspondance nette.</li>
                )}
                {card.items.map((item) => (
                  <li key={item} style={{ display: 'flex', gap: 6, marginBottom: 6, color: '#4a3d70' }}>
                    <span style={{ color: '#4cb782' }}>✔</span> {item}
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
        <span style={{ fontSize: 24 }}>🛡️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#241a3a' }}>Notre engagement mutuel</div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#5b4a8a', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
            Nous nous engageons à respecter ce qui a été défini ensemble, à communiquer avec
            sincérité, et à faire de cette relation quelque chose de sain, durable et
            épanouissant.
          </p>
        </div>
      </div>

      {/* Signatures */}
      <div style={{ marginTop: 32 }}>
        <SectionLabel icon="✍️">Signatures</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 12 }}>
          {[me, other].map((p) => {
            const sig = p ? sigFor(p.id) : null;
            return (
              <div
                key={p?.id ?? Math.random()}
                style={{ border: '1px solid #ece3fb', borderRadius: 18, padding: 18, textAlign: 'center' }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: '#241a3a' }}>
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
                    borderTop: '1px solid #ece3fb',
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
      <div style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: '#a89bc9', fontFamily: 'sans-serif' }}>
        🔒 Ce contrat est symbolique et n’a pas de valeur juridique.
        <br />
        Il représente notre accord et notre engagement mutuel.
      </div>
    </div>
  );
});

export default ContractView;

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: '#241a3a' }}>
      <span aria-hidden>{icon}</span> {children}
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
          fontSize: 18,
        }}
      >
        👤
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#8a7fa8', fontFamily: 'sans-serif' }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#241a3a' }}>
          {name}
          {nickname && <span style={{ fontWeight: 500, color: '#8a7fa8' }}> ({nickname})</span>}
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
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ece3fb" strokeWidth={stroke} />
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
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 20, fontWeight: 800, fill: '#241a3a' }}>
        {score}%
      </text>
      <text x="50%" y="66%" textAnchor="middle" style={{ fontSize: 9, fill: '#8a7fa8', fontFamily: 'sans-serif' }}>
        Compatibilité
      </text>
    </svg>
  );
}
