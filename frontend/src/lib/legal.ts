/** Основной сайт сервиса (Telegram Mini App). */
export const APP_URL = 'https://temka-frontend.onrender.com';

/** Отдельная страница с правовыми документами (для ЮKassa и внешних ссылок). */
export const LEGAL_DOCS_URL = 'https://alexeygalievv-svg.github.io/memory-map/';
export const LEGAL_DOCS_TERMS_URL = `${LEGAL_DOCS_URL}#terms`;
export const LEGAL_DOCS_REQUISITES_URL = `${LEGAL_DOCS_URL}#requisites`;

/** Ссылки внутри основного приложения. */
export const LEGAL_TERMS_PATH = '/legal#legal-terms';
export const LEGAL_REQUISITES_PATH = '/legal#legal-requisites';

export function isLegalPath(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const query = window.location.search.toLowerCase();
  return (
    path.endsWith('/legal') ||
    path.endsWith('/legal.html') ||
    path.endsWith('/requisites') ||
    path.endsWith('/requisites.html') ||
    hash.includes('terms') ||
    hash.includes('offer') ||
    hash.includes('requisites') ||
    query.includes('page=legal') ||
    query.includes('page=requisites')
  );
}
