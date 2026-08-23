import type { KeyboardEvent } from 'react';

/** Убрать экранную клавиатуру: тап мимо поля или Enter в однострочном вводе. */
export function hideSoftKeyboard(event?: { target: EventTarget | null }) {
  if (
    event?.target instanceof HTMLElement &&
    event.target.closest('input, textarea, select, [contenteditable="true"]')
  ) {
    return;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

export function blurOnEnter(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.currentTarget.blur();
}
