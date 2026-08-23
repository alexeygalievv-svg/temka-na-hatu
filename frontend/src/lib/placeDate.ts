const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/** Нормализует дату места в YYYY-MM-DD или null. */
export function normalizePlaceDate(raw?: string | null): string | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** «12 июня 2024» или null, если даты нет. */
export function formatPlaceDate(raw?: string | null): string | null {
  const iso = normalizePlaceDate(raw);
  if (!iso) return null;
  const [, year, month, day] = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  const monthName = MONTHS[Number(month) - 1];
  if (!year || !monthName || !day) return null;
  return `${Number(day)} ${monthName} ${year}`;
}
