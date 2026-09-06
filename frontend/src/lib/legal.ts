/** Ссылки на документы внутри приложения. */
export const LEGAL_TERMS_PATH = '/?page=legal#legal-terms';
export const LEGAL_PRIVACY_PATH = '/?page=legal#legal-privacy';
export const LEGAL_CONTACTS_PATH = '/?page=legal#legal-contacts';

export function isLegalPath(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const query = window.location.search.toLowerCase();
  return (
    path.endsWith('/legal') ||
    hash.includes('terms') ||
    hash.includes('privacy') ||
    hash.includes('contacts') ||
    query.includes('page=legal')
  );
}
