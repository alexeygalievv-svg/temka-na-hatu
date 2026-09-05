/** Официальный знак СБП: фиолетовый скруглённый квадрат и белая монограмма. */
export function SbpIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="10" fill="#5B2C91" />
      <path
        fill="#fff"
        d="M12.2 8.4h9.1c4.7 0 8 2.7 8 7.1 0 3.1-1.7 5.5-4.6 6.5L30 31.6h-4.9l-5.1-6.8h-3.2v6.8h-4.6V8.4zm4.6 3.7v6.4h3.1c2.3 0 3.7-1.2 3.7-3.2s-1.4-3.2-3.7-3.2h-3.1z"
      />
    </svg>
  );
}

export function CardIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="10" fill="#c25932" />
      <rect x="8" y="12" width="24" height="16" rx="3" fill="#fff7ec" />
      <rect x="8" y="16" width="24" height="4" fill="#e8c9bb" />
      <rect x="11" y="23" width="8" height="2.4" rx="1.2" fill="#c25932" />
    </svg>
  );
}
