import type { SVGProps } from 'react';

/**
 * Petit set d'icônes ligne fines et cohérentes (esprit "neon line") pour le
 * contrat — remplace les emoji par un style graphique unique et soigné.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(props: IconProps) {
  const { size = 20, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  };
}

export function IconHeart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 20.5s-7.5-4.6-10-9.3C.5 8 2 4.5 5.4 3.8 8 3.3 10 4.7 12 7c2-2.3 4-3.7 6.6-3.2C22 4.5 23.5 8 22 11.2 19.5 15.9 12 20.5 12 20.5Z" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M20.5 20c0-2.6-1.6-4.4-3.7-5" />
    </svg>
  );
}

export function IconChat(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5h16v11H9.5L5 20.5v-4H4Z" />
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}

export function IconScale(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v18M7 21h10" />
      <path d="M4 7h6M14 7h6" />
      <path d="M4 7 1.5 12.5a2.7 2.7 0 0 0 5 0Z" />
      <path d="M20 7l-2.5 5.5a2.7 2.7 0 0 0 5 0Z" />
    </svg>
  );
}

export function IconStar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6Z" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z" />
      <path d="m9 12 2 2 4-4.2" />
    </svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M11 3.5c.4 2.6 1 4.1 2 5.1s2.5 1.6 5.1 2c-2.6.4-4.1 1-5.1 2s-1.6 2.5-2 5.1c-.4-2.6-1-4.1-2-5.1s-2.5-1.6-5.1-2c2.6-.4 4.1-1 5.1-2s1.6-2.5 2-5.1Z" />
      <path d="M19 3v3M17.5 4.5h3" />
    </svg>
  );
}

export function IconPen(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20.5 4.7 17 16 5.7a2 2 0 0 1 2.8 0l1.5 1.5a2 2 0 0 1 0 2.8L9 21.3 4 20.5Z" />
      <path d="M14 7.5 18 11.5" />
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4.5 12.5 5 5L19.5 7" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </svg>
  );
}
