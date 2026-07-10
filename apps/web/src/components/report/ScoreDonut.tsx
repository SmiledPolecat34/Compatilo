export default function ScoreDonut({ score, size = 160 }: { score: number; size?: number }) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Score de compatibilité : ${score} %`}
    >
      <defs>
        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8f54ec" />
          <stop offset="100%" stopColor="#f45b8f" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#f1eaff"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#scoreGradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-brand-900"
        style={{ fontSize: size * 0.24, fontWeight: 800, fontFamily: 'Fraunces, serif' }}
      >
        {score}%
      </text>
      <text
        x="50%"
        y="64%"
        textAnchor="middle"
        className="fill-slate-400"
        style={{ fontSize: size * 0.075, fontWeight: 600 }}
      >
        compatibilité
      </text>
    </svg>
  );
}
