import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from '../lib/legal';

interface LegalLinksProps {
  className?: string;
}

export function LegalLinks({ className }: LegalLinksProps) {
  return (
    <p className={className}>
      <a href={LEGAL_TERMS_PATH}>Пользовательское соглашение</a>
      <span aria-hidden="true"> · </span>
      <a href={LEGAL_PRIVACY_PATH}>Политика конфиденциальности</a>
    </p>
  );
}
