import { useRef, useState } from 'react';
import { getRawInitData } from '../telegram';

const STORAGE_KEY = 'memory-map-gallery-ok';

function inTelegram(): boolean {
  if (getRawInitData()) return true;
  const legacy = (window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram
    ?.WebApp?.initData;
  return Boolean(legacy?.trim());
}

function alreadyAllowed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberAllowed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* игнорируем */
  }
}

/** Перед первым открытием галереи в Telegram спрашиваем разрешение. */
export function useGalleryPicker(onFile: (file: File) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [asking, setAsking] = useState(false);

  function openPicker() {
    inputRef.current?.click();
  }

  function requestPick() {
    if (!inTelegram() || alreadyAllowed()) {
      openPicker();
      return;
    }
    setAsking(true);
  }

  function allow() {
    rememberAllowed();
    setAsking(false);
    openPicker();
  }

  function deny() {
    setAsking(false);
  }

  function handleChange(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  return { inputRef, asking, requestPick, allow, deny, handleChange };
}
