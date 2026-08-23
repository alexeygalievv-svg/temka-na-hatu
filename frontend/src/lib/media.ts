/** Есть ли настоящее фото — пустую полароид-карточку не рисуем. */
export function hasPhotoUrl(src?: string | null): boolean {
  if (!src) return false;
  const value = src.trim();
  return value.length > 0 && value !== 'null' && value !== 'undefined';
}
