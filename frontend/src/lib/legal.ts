export type LegalSection = 'terms' | 'privacy' | 'prices' | 'contacts';

/** Ссылки на документы — отдельные query, без hash: Telegram Mini App его часто теряет. */
export const LEGAL_TERMS_PATH = '/?page=terms';
export const LEGAL_PRIVACY_PATH = '/?page=privacy';
export const LEGAL_PRICES_PATH = '/?page=prices';
export const LEGAL_CONTACTS_PATH = '/?page=contacts';

const LEGAL_PAGES: LegalSection[] = ['terms', 'privacy', 'prices', 'contacts'];

export function legalSectionId(section: LegalSection): string {
  return `legal-${section}`;
}

export function isLegalPath(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const page = new URLSearchParams(window.location.search).get('page')?.toLowerCase() ?? '';
  return (
    path.endsWith('/legal') ||
    path.endsWith('/terms') ||
    path.endsWith('/privacy') ||
    path.endsWith('/prices') ||
    path.endsWith('/contacts') ||
    hash.includes('legal-') ||
    page === 'legal' ||
    LEGAL_PAGES.includes(page as LegalSection)
  );
}

export function currentLegalSection(): LegalSection {
  const page = new URLSearchParams(window.location.search).get('page')?.toLowerCase() ?? '';
  if (LEGAL_PAGES.includes(page as LegalSection)) return page as LegalSection;
  const hash = window.location.hash.toLowerCase();
  const fromHash = LEGAL_PAGES.find((section) => hash.includes(section));
  return fromHash ?? 'terms';
}
