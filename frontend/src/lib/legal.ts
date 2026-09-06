/** Ссылки на документы внутри приложения. */
export const LEGAL_TERMS_PATH = '/?page=legal#legal-terms';
export const LEGAL_PRIVACY_PATH = '/?page=legal#legal-privacy';
export const LEGAL_PAY_PATH = '/?page=pay';

export function isLegalPath(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const query = window.location.search.toLowerCase();
  if (isPayPath()) return false;
  return (
    path.endsWith('/legal') ||
    hash.includes('terms') ||
    hash.includes('privacy') ||
    query.includes('page=legal')
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
