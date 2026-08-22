import {
  init,
  miniApp,
  viewport,
  hapticFeedback,
  openTelegramLink,
  retrieveLaunchParams,
  retrieveRawInitData,
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
    return retrieveRawInitData() ?? null;
  } catch {
    return null;
  }
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
