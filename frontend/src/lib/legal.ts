/** Основной сайт сервиса (Telegram Mini App). */
export const APP_URL = 'https://temka-frontend.onrender.com';

/** Отдельная страница с правовыми документами (для ЮKassa и внешних ссылок). */
export const LEGAL_DOCS_URL = 'https://alexeygalievv-svg.github.io/memory-map/';
export const LEGAL_DOCS_TERMS_URL = `${LEGAL_DOCS_URL}#terms`;
export const LEGAL_DOCS_REQUISITES_URL = `${LEGAL_DOCS_URL}#requisites`;

/** Ссылки внутри основного приложения (query-параметр работает на Render без SPA rewrite). */
export const LEGAL_TERMS_PATH = '/?page=legal#legal-terms';
export const LEGAL_REQUISITES_PATH = '/?page=legal#legal-requisites';
export const LEGAL_DELIVERY_PATH = '/?page=legal#legal-delivery';
export const LEGAL_CONTACTS_PATH = '/?page=legal#legal-contacts';
export const LEGAL_PRIVACY_PATH = '/?page=legal#legal-privacy';
export const LEGAL_PAY_PATH = '/?page=pay';

export function isLegalPath(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const query = window.location.search.toLowerCase();
  if (isPayPath()) return false;
  return (
    path.endsWith('/legal') ||
    path.endsWith('/legal.html') ||
    path.endsWith('/requisites') ||
    path.endsWith('/requisites.html') ||
    hash.includes('terms') ||
    hash.includes('offer') ||
    hash.includes('privacy') ||
    hash.includes('requisites') ||
    query.includes('page=legal') ||
    query.includes('page=requisites')
  );
}

export function isPayPath(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const query = new URLSearchParams(window.location.search);
  return path.endsWith('/pay') || query.get('page') === 'pay';
}

export function payReturnParams(): { orderId: string | null; mapId: string | null } {
  const query = new URLSearchParams(window.location.search);
  return {
    orderId: query.get('order') || query.get('payment_id'),
    mapId: query.get('map'),
  };
}
