import type { DraftPoint, IntroSettings } from '../types';
import { normalizeIntro } from '../types';

const STORAGE_KEY = 'memory-map-draft-v1';

interface StoredPoint {
  id: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  photoDataUrl: string | null;
}

export interface StoredDraft {
  mapTitle: string;
  authorName: string;
  intro: IntroSettings;
  points: StoredPoint[];
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

async function pointToStored(point: DraftPoint): Promise<StoredPoint> {
  let photoDataUrl: string | null = null;
  if (point.photoFile) {
    photoDataUrl = await fileToDataUrl(point.photoFile);
  } else if (point.photoPreview?.startsWith('data:')) {
    photoDataUrl = point.photoPreview;
  } else if (point.photoPreview) {
    try {
      const blob = await fetch(point.photoPreview).then((r) => r.blob());
      photoDataUrl = await fileToDataUrl(blob);
    } catch {
      photoDataUrl = null;
    }
  }

  return {
    id: point.id,
    title: point.title,
    description: point.description,
    lat: point.lat,
    lng: point.lng,
    photoDataUrl,
  };
}

function storedToPoint(stored: StoredPoint): DraftPoint {
  const photoFile = stored.photoDataUrl
    ? dataUrlToFile(stored.photoDataUrl, `photo-${stored.id}.jpg`)
    : null;
  return {
    id: stored.id,
    title: stored.title,
    description: stored.description,
    lat: stored.lat,
    lng: stored.lng,
    photoFile,
    photoPreview: stored.photoDataUrl,
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
  if (intro.photoPreview?.startsWith('data:') && !intro.photoFile) {
    return {
      ...intro,
      photoFile: dataUrlToFile(intro.photoPreview, 'intro.jpg'),
    };
  }
  return intro;
}

async function introToStored(intro: IntroSettings): Promise<IntroSettings> {
  let photoPreview = intro.photoPreview;
  if (intro.photoFile) {
    photoPreview = await fileToDataUrl(intro.photoFile);
  } else if (photoPreview && !photoPreview.startsWith('data:')) {
    try {
      photoPreview = await fileToDataUrl(await fetch(photoPreview).then((r) => r.blob()));
    } catch {
      /* оставляем как есть */
    }
  }
  return {
    eyebrow: intro.eyebrow,
    message: intro.message,
    buttonText: intro.buttonText,
    photoPreview,
    photoFile: null,
  };
}

export function restorePoints(stored: StoredPoint[]): DraftPoint[] {
  return stored.map(storedToPoint);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveDraftDebounced(draft: {
  mapTitle: string;
  authorName: string;
  intro: IntroSettings;
  points: DraftPoint[];
}): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void (async () => {
      try {
        const points = await Promise.all(draft.points.map(pointToStored));
        const stored: StoredDraft = {
          mapTitle: draft.mapTitle,
          authorName: draft.authorName,
          intro: await introToStored(draft.intro),
          points,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch {
        /* localStorage переполнен — сохраняем без фото */
        try {
          const points = draft.points.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            lat: p.lat,
            lng: p.lng,
            photoDataUrl: null as string | null,
          }));
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...draft, points }),
          );
        } catch {
          /* игнорируем */
        }
      }
    })();
  }, 400);
}

export function clearDraft(): void {
  localStorage.removeItem(STORAGE_KEY);
}
