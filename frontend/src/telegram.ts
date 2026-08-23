import {
  init,
  miniApp,
  viewport,
  hapticFeedback,
  openTelegramLink,
  retrieveLaunchParams,
  retrieveRawInitData,
  copyTextToClipboard,
} from '@telegram-apps/sdk';

/**
 * Инициализация Telegram Mini App SDK.
 * Все вызовы обёрнуты в try/catch, чтобы приложение работало и в обычном
 * браузере во время разработки.
 */
export function initTelegram(): void {
  try {
    init();
  } catch {
    return;
  }
  try {
    if (miniApp.mountSync.isAvailable()) miniApp.mountSync();
  } catch {
    /* не в Telegram */
  }
  try {
    if (viewport.mount.isAvailable()) {
      void viewport
        .mount()
        .then(() => {
          if (viewport.expand.isAvailable()) viewport.expand();
        })
        .catch(() => {});
    }
  } catch {
    /* не в Telegram */
  }
  try {
    if (miniApp.ready.isAvailable()) miniApp.ready();
  } catch {
    /* не в Telegram */
  }
}

/** Сырая строка initData — уходит на backend в заголовке Authorization. */
export function getRawInitData(): string | null {
  try {
    const raw = retrieveRawInitData();
    if (raw) return raw;
  } catch {
    /* не в Telegram */
  }

  const legacy = (window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram
    ?.WebApp?.initData;
  return legacy?.trim() ? legacy : null;
}

/** Параметр startapp (например, `map_AbC123`). */
export function getStartParam(): string | null {
  try {
    return retrieveLaunchParams().tgWebAppStartParam ?? null;
  } catch {
    return null;
  }
}

/** Имя текущего пользователя — для подписи «от кого» на карте. */
export function getUserName(): string | null {
  try {
    const user = retrieveLaunchParams().tgWebAppData?.user;
    if (!user) return null;
    return [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
  } catch {
    return null;
  }
}

/** Лёгкая тактильная отдача на ключевых действиях. */
export function haptic(style: 'light' | 'medium' | 'soft' = 'light'): void {
  try {
    if (hapticFeedback.impactOccurred.isAvailable()) {
      hapticFeedback.impactOccurred(style);
    }
  } catch {
    /* не в Telegram */
  }
}

function tryExecCopy(text: string): boolean {
  const input = document.createElement('input');
  input.value = text;
  input.setAttribute('readonly', '');
  input.setAttribute('inputmode', 'none');
  input.style.cssText =
    'position:fixed;top:8px;left:8px;width:2px;height:2px;opacity:0.02;border:0;padding:0;';
  document.body.appendChild(input);
  input.focus();
  input.select();
  input.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(input);
  return ok;
}

function copyFromInput(input: HTMLInputElement, text: string): boolean {
  input.focus();
  input.select();
  input.setSelectionRange(0, text.length);
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

/** Скопировать текст в буфер — в Telegram на телефоне часто нужен жест пользователя. */
export async function copyText(text: string, fromInput?: HTMLInputElement | null): Promise<boolean> {
  if (fromInput && copyFromInput(fromInput, text)) return true;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* iOS / Telegram WebView часто блокирует Clipboard API */
  }

  if (tryExecCopy(text)) return true;

  try {
    const maybeAvailable = (copyTextToClipboard as { isAvailable?: () => boolean }).isAvailable;
    if (!maybeAvailable || maybeAvailable()) {
      await copyTextToClipboard(text);
      return true;
    }
  } catch {
    /* Telegram иногда говорит «скопировано», хотя буфер пустой */
  }

  return false;
}

/** Открыть диалог «поделиться ссылкой» в Telegram. */
export function shareLink(url: string, text: string): void {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  try {
    if (openTelegramLink.isAvailable()) {
      openTelegramLink(shareUrl);
      return;
    }
  } catch {
    /* не в Telegram */
  }
  window.open(shareUrl, '_blank');
}
