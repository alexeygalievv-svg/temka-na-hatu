import { formatPlaceDateNumeric } from '../lib/placeDate';

interface DateFieldProps {
  value?: string | null;
  onChange: (value: string | null) => void;
}

export function DateField({ value, onChange }: DateFieldProps) {
  const label = formatPlaceDateNumeric(value);

  return (
    <label className={`date-field${label ? ' date-field--filled' : ''}`}>
      <span className="date-field__text">{label ?? 'ДД.ММ.ГГГГ'}</span>
      <svg className="date-field__icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.4" y="5" width="17.2" height="15.6" rx="2.6" />
        <path d="M8 3.2v3.8M16 3.2v3.8M3.4 9.8h17.2" />
        <rect x="7.1" y="12.4" width="2.2" height="2.2" rx="0.4" />
        <rect x="10.9" y="12.4" width="2.2" height="2.2" rx="0.4" />
        <rect x="14.7" y="12.4" width="2.2" height="2.2" rx="0.4" />
        <rect x="7.1" y="16.2" width="2.2" height="2.2" rx="0.4" />
        <rect x="10.9" y="16.2" width="2.2" height="2.2" rx="0.4" />
      </svg>
      <input
        type="date"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        aria-label="Дата"
      />
    </label>
  );
}
