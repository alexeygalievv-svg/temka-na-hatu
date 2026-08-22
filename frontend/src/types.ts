import type { IntroSettings } from './lib/intro';

export type { IntroSettings } from './lib/intro';
export { DEFAULT_INTRO } from './lib/intro';

/** Точка, как её видит получатель (данные с сервера или из предпросмотра). */
export interface MemoryPoint {
  id: string;
  title: string;
  description: string;
  photoUrl: string | null;
  lat: number;
  lng: number;
}

/** Точка в конструкторе: фото хранится локально до публикации. */
export interface DraftPoint {
  id: string;
  title: string;
  description: string;
  photoFile: File | null;
  /** Object URL для мгновенного предпросмотра. */
  photoPreview: string | null;
  lat: number;
  lng: number;
}

export interface MemoryMapData {
  id: string;
  title: string;
  authorName: string | null;
  intro: IntroSettings;
  points: MemoryPoint[];
}

export type PublishProgress =
  | { step: 'map' }
  | { step: 'photo'; index: number; total: number }
  | { step: 'point'; index: number; total: number };
