/** Íconos de línea para la barra de navegación (24×24, heredan el color). */
const P = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export type IconName =
  | 'home'
  | 'cart'
  | 'hammer'
  | 'heart'
  | 'users'
  | 'medal'
  | 'feed'
  | 'gear'
  | 'swap'
  | 'check'
  | 'sun'
  | 'moon'
  | 'chat'
  | 'calendar'
  | 'target'
  | 'build'
  | 'bell'
  | 'send';

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...P}>
      {name === 'home' && (
        <>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9.5h13V10" />
          <path d="M10 19.5v-5h4v5" />
        </>
      )}
      {name === 'cart' && (
        <>
          <path d="M3 4h2.5l2.2 11h10.6l2-8H6.6" />
          <circle cx="9.5" cy="19" r="1.4" />
          <circle cx="17" cy="19" r="1.4" />
        </>
      )}
      {name === 'hammer' && (
        <>
          <path d="m14 6 4 4" />
          <path d="M11.5 3.5 17 9l3-3-2.5-2.5c-1.5-1.5-4-1.5-6 0Z" />
          <path d="m14.5 8.5-10 10a1.4 1.4 0 0 0 2 2l10-10" />
        </>
      )}
      {name === 'heart' && <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z" />}
      {name === 'users' && (
        <>
          <circle cx="9" cy="8.5" r="3.2" />
          <path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5" />
          <path d="M15.5 5.6a3 3 0 0 1 0 5.8" />
          <path d="M17.5 14.7c1.9.6 3.1 2.2 3.5 4.8" />
        </>
      )}
      {name === 'medal' && (
        <>
          <circle cx="12" cy="15" r="5" />
          <path d="m8.5 11-3-7h4l2.5 5" />
          <path d="m15.5 11 3-7h-4L12 9" />
          <path d="m12 12.6.9 1.7 1.8.3-1.3 1.3.3 1.8-1.7-.9-1.7.9.3-1.8-1.3-1.3 1.8-.3Z" />
        </>
      )}
      {name === 'feed' && (
        <>
          <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
          <path d="M8 8.5h8M8 12h8M8 15.5h5" />
        </>
      )}
      {name === 'gear' && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
        </>
      )}
      {name === 'swap' && (
        <>
          <path d="M4 8h14l-3.5-3.5" />
          <path d="M20 16H6l3.5 3.5" />
        </>
      )}
      {name === 'check' && <path d="m5 12.5 4.5 4.5L19 7.5" />}
      {name === 'sun' && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3" />
        </>
      )}
      {name === 'moon' && <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />}
      {name === 'chat' && (
        <>
          <path d="M4 5.5h16v10H10l-4.5 3.5V15.5H4Z" />
          <path d="M8 9.5h8M8 12.5h5" />
        </>
      )}
      {name === 'calendar' && (
        <>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 9.5h17M8 3v4M16 3v4" />
          <path d="M8 13h2M14 13h2M8 16.5h2" />
        </>
      )}
      {name === 'target' && (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1.2" />
        </>
      )}
      {name === 'build' && (
        <>
          <path d="M3 20.5h18" />
          <path d="M5 20.5V10l7-5.5 7 5.5v10.5" />
          <path d="M9.5 20.5v-6h5v6" />
          <path d="M12 2v2.5" />
        </>
      )}
      {name === 'bell' && (
        <>
          <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" />
          <path d="M10 20.5a2 2 0 0 0 4 0" />
        </>
      )}
      {name === 'send' && (
        <>
          <path d="M4 12 20 4l-5 16-3-6.5Z" />
          <path d="m12 13.5 8-9.5" />
        </>
      )}
    </svg>
  );
}
