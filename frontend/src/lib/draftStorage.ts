import type { DraftPoint, IntroSettings } from '../types';
import { normalizeIntro } from '../types';
import { compressImageForDraft, fileToDataUrl } from './compressImage';

const STORAGE_KEY = 'memory-map-draft-v1';

interface StoredPoint {
  id: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  photoDataUrl: string | null;
  happenedOn: string | null;
}

export interface StoredDraft {
  mapTitle: string;
  authorName: string;
  intro: IntroSettings;
  points: StoredPoint[];
}

function isRemoteUrl(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith('https://') || value?.startsWith('http://'));
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

async function persistablePhoto(
  file: File | null | undefined,
  preview: string | null | undefined,
): Promise<string | null> {
  if (isRemoteUrl(preview)) return preview ?? null;
  if (preview?.startsWith('data:image/') && preview.length < 180_000) return preview;
  const source =
    file instanceof File && file.size > 0
      ? file
      : preview?.startsWith('data:')
        ? new File(
            [await (await fetch(preview)).blob()],
            'photo.jpg',
            { type: 'image/jpeg' },
          )
        : null;
  if (source) {
    try {
      return await fileToDataUrl(await compressImageForDraft(source));
    } catch {
      /* дальше пробуем превью */
    }
  }
  if (!preview) return null;
  try {
    const blob = await fetch(preview).then((response) => response.blob());
    const compact = await compressImageForDraft(new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }));
    return await fileToDataUrl(compact);
  } catch {
    return null;
  }
}

async function pointToStored(point: DraftPoint): Promise<StoredPoint> {
  return {
    id: point.id,
    title: point.title,
    description: point.description,
    lat: point.lat,
    lng: point.lng,
    photoDataUrl: await persistablePhoto(point.photoFile, point.photoPreview),
    happenedOn: point.happenedOn,
  };
}

function storedToPoint(stored: StoredPoint): DraftPoint {
  const photo = stored.photoDataUrl;
  const photoFile = photo?.startsWith('data:') ? dataUrlToFile(photo, `photo-${stored.id}.jpg`) : null;
  return {
    id: stored.id,
    title: stored.title,
    description: stored.description,
    lat: stored.lat,
    lng: stored.lng,
    photoFile,
    photoPreview: photo,
    happenedOn: stored.happenedOn ?? null,
  };
}

export function loadDraft(): StoredDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredDraft;
    if (!data || !Array.isArray(data.points)) return null;
    return {
      mapTitle: data.mapTitle ?? 'Наши места',
      authorName: data.authorName ?? '',
      intro: restoreIntro(data.intro),
      points: data.points,
    };
  } catch {
    return null;
  }
}

function restoreIntro(raw: Partial<IntroSettings> | undefined): IntroSettings {
  const intro = normalizeIntro(raw);
  if (intro.photoPreview?.startsWith('data:') && !(intro.photoFile instanceof File)) {
    return {
      ...intro,
      photoFile: dataUrlToFile(intro.photoPreview, 'intro.jpg'),
    };
  }
  return intro;
}

async function introToStored(intro: IntroSettings): Promise<IntroSettings> {
  return {
    eyebrow: intro.eyebrow,
    message: intro.message,
    buttonText: intro.buttonText,
    photoPreview: await persistablePhoto(intro.photoFile, intro.photoPreview),
    photoFile: null,
  };
}

export function restorePoints(stored: StoredPoint[]): DraftPoint[] {
  return stored.map(storedToPoint);
}

function writeDraft(stored: StoredDraft): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function draftWithoutHeavyPhotos(stored: StoredDraft): StoredDraft {
  return {
    ...stored,
    intro: {
      ...stored.intro,
      photoPreview: isRemoteUrl(stored.intro.photoPreview) ? stored.intro.photoPreview : null,
      photoFile: null,
    },
    points: stored.points.map((point) => ({
      ...point,
      photoDataUrl: isRemoteUrl(point.photoDataUrl) ? point.photoDataUrl : null,
    })),
  };
}

async function persistDraft(draft: {
  mapTitle: string;
  authorName: string;
  intro: IntroSettings;
  points: DraftPoint[];
}): Promise<void> {
  const stored: StoredDraft = {
    mapTitle: draft.mapTitle,
    authorName: draft.authorName,
    intro: await introToStored(draft.intro),
    points: await Promise.all(draft.points.map(pointToStored)),
  };
  try {
    writeDraft(stored);
    return;
  } catch {
    /* localStorage переполнен — не стираем уже сохранённые ссылки */
  }
  try {
    writeDraft(draftWithoutHeavyPhotos(stored));
  } catch {
    /* оставляем предыдущий черновик как есть */
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let persistGen = 0;

export function saveDraftDebounced(draft: {
  mapTitle: string;
  authorName: string;
  intro: IntroSettings;
  points: DraftPoint[];
}): void {
  if (saveTimer) clearTimeout(saveTimer);
  const snapshot = draft;
  saveTimer = setTimeout(() => {
    const gen = ++persistGen;
    void persistDraft(snapshot).then(() => {
      if (gen !== persistGen) return;
    });
  }, 400);
}

export async function saveDraftNow(draft: {
  mapTitle: string;
  authorName: string;
  intro: IntroSettings;
  points: DraftPoint[];
}): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  persistGen += 1;
  await persistDraft(draft);
}

export function clearDraft(): void {
  localStorage.removeItem(STORAGE_KEY);
}
