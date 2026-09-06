/** Знак СБП из папки проекта. */
export function SbpIcon({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/sbp.png"
      alt=""
      width={size}
      height={size}
      className="pay-method__logo"
      draggable={false}
    />
  );
}

/** Знак «Мир» для карт РФ из папки проекта. */
export function CardIcon({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/mir.png"
      alt=""
      width={size}
      height={size}
      className="pay-method__logo"
      draggable={false}
    />
  );
}

export function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="10" fill="#fff" />
      <path
        d="M5.8 10.4 8.4 13l5.8-6.2"
        fill="none"
        stroke="#111"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
