/** Настройки экрана «Открыть карту», который видит получатель. */
export interface IntroSettings {
  eyebrow: string;
  message: string;
  buttonText: string;
  /** Превью или опубликованный URL полароид-фото. */
  photoPreview: string | null;
  /** Локальный файл до публикации. */
  photoFile: File | null;
}

export const DEFAULT_INTRO: IntroSettings = {
  eyebrow: 'Для тебя собрал',
  message: 'Здесь остались наши самые тёплые моменты',
  buttonText: 'Открыть карту',
  photoPreview: null,
  photoFile: null,
};

export function normalizeIntro(raw?: Partial<IntroSettings> | null): IntroSettings {
  return {
    eyebrow: raw?.eyebrow ?? DEFAULT_INTRO.eyebrow,
    message: raw?.message ?? DEFAULT_INTRO.message,
    buttonText: raw?.buttonText ?? DEFAULT_INTRO.buttonText,
    photoPreview: raw?.photoPreview ?? null,
    photoFile: raw?.photoFile ?? null,
  };
}

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
