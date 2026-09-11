import {
  LEGAL_CONTACTS_PATH,
  LEGAL_PRICES_PATH,
  LEGAL_PRIVACY_PATH,
  LEGAL_TERMS_PATH,
} from '../lib/legal';

interface LegalLinksProps {
  className?: string;
}

export function LegalLinks({ className }: LegalLinksProps) {
  return (
    <nav className={className ?? 'legal-buttons'} aria-label="Документы и поддержка">
      <a href={LEGAL_TERMS_PATH}>Пользовательское соглашение</a>
      <a href={LEGAL_PRIVACY_PATH}>Политика конфиденциальности</a>
      <a href={LEGAL_PRICES_PATH}>Цены и тарифы</a>
      <a href={LEGAL_CONTACTS_PATH}>Поддержка</a>
    </nav>
  );
}
