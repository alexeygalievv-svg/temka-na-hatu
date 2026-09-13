import {
  LEGAL_CONTACTS_PATH,
  LEGAL_PRICES_PATH,
  LEGAL_PRIVACY_PATH,
  LEGAL_TERMS_PATH,
} from '../lib/legal';

interface LegalLinksProps {
  className?: string;
  compact?: boolean;
}

export function LegalLinks({ className, compact }: LegalLinksProps) {
  return (
    <nav className={className ?? 'legal-buttons'} aria-label="Документы и поддержка">
      <a href={LEGAL_TERMS_PATH}>{compact ? 'Соглашение' : 'Пользовательское соглашение'}</a>
      <a href={LEGAL_PRIVACY_PATH}>{compact ? 'Конфиденциальность' : 'Политика конфиденциальности'}</a>
      <a href={LEGAL_PRICES_PATH}>{compact ? 'Цены' : 'Цены и тарифы'}</a>
      <a href={LEGAL_CONTACTS_PATH}>Поддержка</a>
    </nav>
  );
}
