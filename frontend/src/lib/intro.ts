/** Настройки экрана «Открыть карту», который видит получатель. */
export interface IntroSettings {
  eyebrow: string;
  message: string;
  buttonText: string;
}

export const DEFAULT_INTRO: IntroSettings = {
  eyebrow: 'Для тебя собрал',
  message: 'Здесь остались наши самые тёплые моменты',
  buttonText: 'Открыть карту',
};

export function formatPlacesWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'место';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'места';
  return 'мест';
}

export function resolveIntroMessage(message: string, _count: number): string {
  const text = message.trim() || 'Здесь остались наши самые тёплые моменты';
  return text
    .replace(/\{count\}/g, String(_count))
    .replace(/\{places\}/g, formatPlacesWord(_count));
}
