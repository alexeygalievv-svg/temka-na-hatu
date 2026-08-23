import type { MemoryMapData } from './types';
import { getRawInitData } from './telegram';

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

function authHeaders(): Record<string, string> {
  const raw = getRawInitData();
  if (raw) return { Authorization: `tma ${raw}` };
  // Вне Telegram (локальная разработка) — dev-заголовок,
  // backend принимает его только при ALLOW_DEV_AUTH=true.
  if (import.meta.env.DEV) return { Authorization: 'dev' };
  return {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* тело не JSON */
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export function createMap(payload: {
  title: string;
  authorName?: string | null;
  introEyebrow?: string;
  introMessage?: string;
  introButton?: string;
  introPhotoDataUrl?: string;
}) {
  return request<{ id: string; link: string }>('/api/maps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      title: payload.title,
      authorName: payload.authorName ?? undefined,
      introEyebrow: payload.introEyebrow,
      introMessage: payload.introMessage,
      introButton: payload.introButton,
      introPhotoDataUrl: payload.introPhotoDataUrl,
    }),
  });
}

export function updateMap(
  mapId: string,
  payload: {
    introPhotoUrl?: string | null;
  },
) {
  return request<{ ok: true }>(`/api/maps/${mapId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
}

export function addPoint(
  mapId: string,
  point: {
    title: string;
    description: string;
    photoUrl: string | null;
    happenedOn?: string | null;
    lat: number;
    lng: number;
    orderIndex: number;
  },
) {
  return request<{ id: string }>(`/api/maps/${mapId}/points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(point),
  });
}

export function uploadPhoto(mapId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return request<{ url: string }>(`/api/maps/${mapId}/photos`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
}

export function fetchMap(mapId: string) {
  return request<MemoryMapData>(`/api/maps/${mapId}`);
}
