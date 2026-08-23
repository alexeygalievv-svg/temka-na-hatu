import { formatPlaceDate } from '../lib/placeDate';

interface PlaceDateProps {
  value?: string | null;
  className?: string;
}

export function PlaceDate({ value, className }: PlaceDateProps) {
  const label = formatPlaceDate(value);
  if (!label) return null;

  return (
    <p className={['place-date', className].filter(Boolean).join(' ')}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="3.2" />
        <path d="M8.2 3.1v3.5M15.8 3.1v3.5M3.5 9.8h17" />
        <rect className="place-date__dot" x="6.6" y="12.2" width="2.15" height="2.15" rx="0.5" />
        <rect className="place-date__dot" x="10.95" y="12.2" width="2.15" height="2.15" rx="0.5" />
        <rect className="place-date__dot" x="15.3" y="12.2" width="2.15" height="2.15" rx="0.5" />
        <rect className="place-date__dot" x="6.6" y="16.05" width="2.15" height="2.15" rx="0.5" />
        <rect className="place-date__dot" x="10.95" y="16.05" width="2.15" height="2.15" rx="0.5" />
        <rect className="place-date__dot" x="15.3" y="16.05" width="2.15" height="2.15" rx="0.5" />
      </svg>
      <span>{label}</span>
    </p>
  );
}
