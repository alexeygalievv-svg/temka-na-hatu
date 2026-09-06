/** Знак СБП: цветной узел на белом квадрате. */
export function SbpIcon({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="8" fill="#fff" />
      <path fill="#1D4ED8" d="M20 8.2 31.2 20 20 31.8 8.8 20 20 8.2Z" />
      <path fill="#16A34A" d="M20 8.2 31.2 20 20 20Z" />
      <path fill="#DC2626" d="M20 20 31.2 20 20 31.8Z" />
      <path fill="#F59E0B" d="M8.8 20 20 8.2 20 20Z" />
      <path fill="#fff" d="M20 14.6 25.4 20 20 25.4 14.6 20 20 14.6Z" />
    </svg>
  );
}

/** Знак платёжной системы «Мир» для карт РФ. */
export function CardIcon({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="8" fill="#141414" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="13"
        fill="#22c55e"
      >
        МИР
      </text>
    </svg>
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
