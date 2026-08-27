/**
 * Загрузчик Яндекс.Карт JS API 2.1.
 * Ключи пакета «JavaScript API» из кабинета Яндекса чаще всего работают именно с 2.1,
 * а не с /v3/.
 */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ymaps: any;
  }
}

let loader: Promise<unknown> | null = null;

const PLACEHOLDER_KEYS = new Set(['', 'your-yandex-maps-key', 'ваш-ключ-яндекс-карт']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadYmaps(): Promise<any> {
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim();
    if (!apiKey || PLACEHOLDER_KEYS.has(apiKey)) {
      reject(
        new Error(
          'Добавьте ключ в frontend/.env → VITE_YANDEX_MAPS_API_KEY и перезапустите npm run dev',
        ),
      );
      return;
    }

    if (window.ymaps?.ready) {
      window.ymaps.ready(() => resolve(window.ymaps));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU&mode=release`;
    script.async = true;
    script.onload = () => {
      if (!window.ymaps?.ready) {
        loader = null;
        reject(new Error('Скрипт карт загрузился, но ymaps недоступен'));
        return;
      }
      window.ymaps.ready(
        () => resolve(window.ymaps),
        (error: Error) => {
          loader = null;
          reject(error ?? new Error('ymaps.ready завершился с ошибкой'));
        },
      );
    };
    script.onerror = () => {
      loader = null;
      reject(
        new Error(
          'Не удалось загрузить Яндекс.Карты. Проверьте ключ, ограничение Referer: localhost и перезапустите npm run dev',
        ),
      );
    };
    document.head.appendChild(script);
  });

  return loader;
}
