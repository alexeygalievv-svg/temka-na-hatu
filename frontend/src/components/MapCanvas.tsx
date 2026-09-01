import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { loadYmaps } from '../lib/ymaps';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  active?: boolean;
}

export interface MapHandle {
  waitUntilReady: () => Promise<void>;
  /** Прогревает тайлы по маршруту камеры, пока карта ещё стоит. */
  preloadRoute: (lat: number, lng: number, zoom?: number) => Promise<void>;
  flyTo: (lat: number, lng: number, zoom?: number, duration?: number) => Promise<void>;
  /** Прерывает текущий перелёт камеры, чтобы можно было сразу перейти к обзору. */
  cancelFlight: () => void;
  fitAll: (points: Array<{ lat: number; lng: number }>, duration?: number) => void;
}

interface MapCanvasProps {
  initialCenter: { lat: number; lng: number };
  initialZoom: number;
  pins: MapPin[];
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  onPinClick?: (id: string) => void;
  ref?: Ref<MapHandle>;
}

/** Размеры пина — должны совпадать с CSS и iconImageOffset. */
const PIN_W = 40;
const PIN_H = 42;
/** 3px на округление проекции: веер только если иконка целиком под другой. */
const PIN_COVER_TOL = 3;

type PinItem = { pin: MapPin; px: number; py: number };
type PinAabb = { left: number; right: number; top: number; bottom: number };
type PinFan = { angle: number; x: number; y: number; z: number; clickId: string; interactive: boolean };

function prefersTouchMap(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches ||
    'ontouchstart' in window
  );
}

function pinAabb(px: number, py: number): PinAabb {
  return {
    left: px - PIN_W / 2,
    right: px + PIN_W / 2,
    top: py - PIN_H,
    bottom: py,
  };
}

function rotatedPinAabb(originPx: number, originPy: number, angleDeg: number): PinAabb {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners: Array<[number, number]> = [
    [originPx - PIN_W / 2, originPy - PIN_H],
    [originPx + PIN_W / 2, originPy - PIN_H],
    [originPx + PIN_W / 2, originPy],
    [originPx - PIN_W / 2, originPy],
  ];
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const [x, y] of corners) {
    const dx = x - originPx;
    const dy = y - originPy;
    const rx = originPx + dx * cos - dy * sin;
    const ry = originPy + dx * sin + dy * cos;
    left = Math.min(left, rx);
    right = Math.max(right, rx);
    top = Math.min(top, ry);
    bottom = Math.max(bottom, ry);
  }
  return { left, right, top, bottom };
}

function aabbFullyContains(outer: PinAabb, inner: PinAabb): boolean {
  return (
    inner.left >= outer.left - PIN_COVER_TOL &&
    inner.right <= outer.right + PIN_COVER_TOL &&
    inner.top >= outer.top - PIN_COVER_TOL &&
    inner.bottom <= outer.bottom + PIN_COVER_TOL
  );
}

function pinFullyCovers(
  origin: { px: number; py: number },
  angleDeg: number,
  other: { px: number; py: number },
): boolean {
  return aabbFullyContains(rotatedPinAabb(origin.px, origin.py, angleDeg), pinAabb(other.px, other.py));
}

/** Ровный разворот вокруг одной нижней точки. */
function fanAngles(count: number): number[] {
  if (count <= 1) return [0];
  const max = Math.min(26, 11 + (count - 2) * 3);
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return Math.round((-max + t * 2 * max) * 10) / 10;
  });
}

function clusterCentroid(cluster: PinItem[]): { px: number; py: number } {
  let px = 0;
  let py = 0;
  for (const item of cluster) {
    px += item.px;
    py += item.py;
  }
  return { px: px / cluster.length, py: py / cluster.length };
}

function collectGroups(items: PinItem[], parent: number[]): PinItem[][] {
  const groups = new Map<number, PinItem[]>();
  items.forEach((item, index) => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    const group = groups.get(root);
    if (group) group.push(item);
    else groups.set(root, [item]);
  });
  return [...groups.values()];
}

function computePinFans(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  pins: MapPin[],
): Map<string, PinFan> {
  const offsets = new Map<string, PinFan>();
  if (pins.length === 0) return offsets;
  try {
    const zoom = Number(map.getZoom?.() ?? 10);
    const projection = map.options.get('projection');
    const items = pins.map((pin) => {
      const [px, py] = projection.toGlobalPixels([pin.lat, pin.lng], zoom) as [number, number];
      return { pin, px, py };
    });
    const parent = items.map((_, index) => index);
    const find = (index: number): number => {
      if (parent[index] !== index) parent[index] = find(parent[index]);
      return parent[index];
    };
    const unite = (a: number, b: number) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent[rootB] = rootA;
    };
    const indexById = new Map(items.map((item, index) => [item.pin.id, index]));

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (
          pinFullyCovers(items[i], 0, items[j]) ||
          pinFullyCovers(items[j], 0, items[i])
        ) {
          unite(i, j);
        }
      }
    }

    let grew = true;
    for (let step = 0; grew && step < items.length; step++) {
      grew = false;
      const groups = collectGroups(items, parent);
      for (const cluster of groups) {
        if (cluster.length < 2) continue;
        cluster.sort((a, b) => Number(a.pin.label) - Number(b.pin.label));
        const origin = clusterCentroid(cluster);
        const angles = fanAngles(cluster.length);
        const inFan = new Set(cluster.map((item) => item.pin.id));
        for (const other of items) {
          if (inFan.has(other.pin.id)) continue;
          const covered = cluster.some((_, index) => pinFullyCovers(origin, angles[index] ?? 0, other));
          if (!covered) continue;
          const from = indexById.get(cluster[0].pin.id);
          const to = indexById.get(other.pin.id);
          if (from === undefined || to === undefined) continue;
          unite(from, to);
          grew = true;
        }
      }
    }

    for (const cluster of collectGroups(items, parent)) {
      cluster.sort((a, b) => Number(a.pin.label) - Number(b.pin.label));
      const fanned = cluster.length > 1;
      const origin = fanned ? clusterCentroid(cluster) : cluster[0];
      const angles = fanned ? fanAngles(cluster.length) : [0];
      const topPin = cluster[cluster.length - 1]?.pin;
      cluster.forEach((item, index) => {
        const isTop = !fanned || item.pin.id === topPin?.id;
        offsets.set(item.pin.id, {
          angle: angles[index] ?? 0,
          x: fanned ? origin.px - item.px : 0,
          y: fanned ? origin.py - item.py : 0,
          z: item.pin.active ? 1400 : isTop ? 1200 + index : 900 + index,
          clickId: fanned && topPin ? topPin.id : item.pin.id,
          interactive: isTop,
        });
      });
    }
  } catch {
    for (const pin of pins) {
      offsets.set(pin.id, { angle: 0, x: 0, y: 0, z: 1000, clickId: pin.id, interactive: true });
    }
  }
  return offsets;
}

const TILE_SIZE = 256;
const PRELOAD_TIMEOUT_MS = 4000;
const PRELOAD_MAX_TILES = 96;
const FIRST_TILES_TIMEOUT_MS = 5000;
const FLIGHT_STAGE_HOLD_MS = 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

type TileLogEntry = {
  t: number;
  kind: string;
  [key: string]: unknown;
};

type TileFlight = {
  id: number;
  mapTileload: number;
  mapTileerror: number;
  layerTileload: number;
  layerTileerror: number;
  tileloadchange: number;
  readyMin: number;
  readyMax: number;
  totalMax: number;
  incompleteTicks: number;
  sizeChanges: number;
};

function tileWindow() {
  const w = window as Window & {
    __mapTileLog?: TileLogEntry[];
    __mapTileSummary?: Record<string, number>;
    __mapTileFlight?: TileFlight | null;
  };
  if (!w.__mapTileLog) w.__mapTileLog = [];
  if (!w.__mapTileSummary) {
    w.__mapTileSummary = {
      mapTileload: 0,
      mapTileerror: 0,
      layerTileload: 0,
      layerTileerror: 0,
      layerTileloadchange: 0,
      sizechange: 0,
    };
  }
  return w;
}

function logTile(kind: string, extra: Record<string, unknown> = {}) {
  const w = tileWindow();
  const flight = w.__mapTileFlight;
  const entry: TileLogEntry = {
    t: Math.round(performance.now()),
    kind,
    flight: flight?.id ?? null,
    ...extra,
  };
  w.__mapTileLog!.push(entry);
  if (w.__mapTileLog!.length > 500) w.__mapTileLog!.splice(0, 120);
  if (flight || kind.startsWith('FLY_') || kind.startsWith('diag.')) {
    console.log('[ymaps-tiles]', kind, extra);
  }
}

function bump(key: keyof NonNullable<ReturnType<typeof tileWindow>['__mapTileSummary']>) {
  const summary = tileWindow().__mapTileSummary;
  if (summary) summary[key] = (summary[key] ?? 0) + 1;
}

/** Ждём не меньше duration: промис Яндекса часто резолвится сразу. */
function waitForAnimation(animation: unknown, minMs: number): Promise<void> {
  const minWait = minMs > 0 ? sleep(minMs) : Promise.resolve();
  const anim =
    animation &&
    typeof animation === 'object' &&
    'then' in animation &&
    typeof (animation as { then?: unknown }).then === 'function'
      ? Promise.resolve(animation as PromiseLike<unknown>).then(
          () => undefined,
          () => undefined,
        )
      : Promise.resolve();
  return Promise.all([minWait, anim]).then(() => undefined);
}

/** Расстояние между точками в глобальных пикселях на текущем зуме. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pixelDistance(map: any, from: [number, number], to: [number, number], zoom: number): number {
  try {
    const projection = map.options.get('projection');
    const a = projection.toGlobalPixels(from, zoom) as [number, number];
    const b = projection.toGlobalPixels(to, zoom) as [number, number];
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** Как у panTo: ближе двух экранов — обычный переезд без отъезда. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isNearbyFlight(map: any, from: [number, number], to: [number, number], zoom: number): boolean {
  const size = map.container?.getSize?.() as [number, number] | undefined;
  if (!size) return false;
  return pixelDistance(map, from, to, zoom) < 2 * Math.max(size[0], size[1]);
}

/** Широкий зум, на котором камера едет к следующей точке. */
function overviewForFlight(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ymaps: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  from: [number, number],
  to: [number, number],
  fromZoom: number,
  targetZoom: number,
): { center: [number, number]; zoom: number } {
  const size = map.container.getSize() as [number, number];
  try {
    const bounds = ymaps.util.bounds.fromPoints([from, to]);
    const projection = map.options.get('projection') ?? ymaps.projection?.wgs84Mercator;
    // 3-й аргумент — проекция, не options. Иначе getCenterAndZoom падает.
    const fitted = ymaps.util.bounds.getCenterAndZoom(bounds, size, projection, {
      zoomMargin: 64,
    }) as { center: [number, number]; zoom: number };
    const zoom = Math.max(
      2,
      Math.min(Math.floor(fitted.zoom), Math.min(Math.round(fromZoom), targetZoom) - 2),
    );
    return { center: fitted.center, zoom };
  } catch {
    return {
      center: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
      zoom: 2,
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function attachTileDiagnostics(map: any, container: HTMLElement | null): () => void {
  const onMapTileload = () => {
    bump('mapTileload');
    const flight = tileWindow().__mapTileFlight;
    if (flight) flight.mapTileload += 1;
    logTile('map.tileload', { zoom: map.getZoom?.() });
  };
  const onMapTileerror = () => {
    bump('mapTileerror');
    const flight = tileWindow().__mapTileFlight;
    if (flight) flight.mapTileerror += 1;
    logTile('map.tileerror', { zoom: map.getZoom?.() });
  };
  const onSizeChange = (event: { get: (key: string) => unknown }) => {
    bump('sizechange');
    const flight = tileWindow().__mapTileFlight;
    if (flight) flight.sizeChanges += 1;
    logTile('map.sizechange', {
      oldSize: event.get('oldSize'),
      newSize: event.get('newSize'),
      flying: Boolean(flight),
    });
  };

  try {
    map.events.add('tileload', onMapTileload);
    map.events.add('tileerror', onMapTileerror);
  } catch {
    logTile('map.tile-events-missing', { note: 'Map не бросает tileload/tileerror' });
  }
  map.events.add('sizechange', onSizeChange);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boundLayers = new Set<any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bindLayer = (layer: any) => {
    if (!layer || boundLayers.has(layer)) return;
    boundLayers.add(layer);
    try {
      layer.events?.add('tileload', () => {
        bump('layerTileload');
        const flight = tileWindow().__mapTileFlight;
        if (flight) flight.layerTileload += 1;
        logTile('layer.tileload', { zoom: map.getZoom?.() });
      });
      layer.events?.add('tileerror', () => {
        bump('layerTileerror');
        const flight = tileWindow().__mapTileFlight;
        if (flight) flight.layerTileerror += 1;
        logTile('layer.tileerror', { zoom: map.getZoom?.() });
      });
      layer.events?.add('tileloadchange', (event: { get: (key: string) => unknown }) => {
        const ready = Number(event.get('readyTileNumber') ?? 0);
        const total = Number(event.get('totalTileNumber') ?? 0);
        bump('layerTileloadchange');
        const flight = tileWindow().__mapTileFlight;
        if (flight) {
          flight.tileloadchange += 1;
          flight.readyMin = Math.min(flight.readyMin, ready);
          flight.readyMax = Math.max(flight.readyMax, ready);
          flight.totalMax = Math.max(flight.totalMax, total);
          if (total > 0 && ready < total) flight.incompleteTicks += 1;
        }
        if (ready === 0 || ready === total || (flight && flight.tileloadchange % 8 === 0)) {
          logTile('layer.tileloadchange', { ready, total, zoom: map.getZoom?.() });
        }
      });
    } catch {
      /* слой без событий */
    }
  };

  try {
    map.layers?.each?.(bindLayer);
    const first = findTileLayer(map.layers);
    if (first) bindLayer(first);
    map.layers?.events?.add?.('add', (event: { get: (key: string) => unknown }) => {
      bindLayer(event.get('layer') ?? event.get('child') ?? event.get('object'));
    });
  } catch {
    /* manager без each */
  }

  const ro =
    container && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
          const box = entries[0]?.contentRect;
          logTile('dom.resize', {
            width: Math.round(box?.width ?? 0),
            height: Math.round(box?.height ?? 0),
            flying: Boolean(tileWindow().__mapTileFlight),
          });
        })
      : null;
  if (ro && container) ro.observe(container);

  logTile('diag.attached', {
    mapEvents: ['tileload', 'tileerror', 'sizechange'],
    layerEvents: ['tileload', 'tileerror', 'tileloadchange'],
    note: 'официальный API 2.1: tileloadchange на Layer, не на Map',
  });

  return () => {
    try {
      map.events.remove('tileload', onMapTileload);
      map.events.remove('tileerror', onMapTileerror);
      map.events.remove('sizechange', onSizeChange);
    } catch {
      /* destroy */
    }
    ro?.disconnect();
  };
}

function setMapGesturing(on: boolean) {
  document.body.classList.toggle('map-gesturing', on);
}

/** На телефоне сразу гасим оверлеи и пины — иначе щипок рвётся. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function attachGestureHints(map: any, container: HTMLElement | null): () => void {
  let endTimer: number | null = null;
  const onBegin = () => {
    if (endTimer !== null) {
      window.clearTimeout(endTimer);
      endTimer = null;
    }
    setMapGesturing(true);
  };
  const onEnd = () => {
    if (endTimer !== null) window.clearTimeout(endTimer);
    endTimer = window.setTimeout(() => {
      endTimer = null;
      setMapGesturing(false);
    }, 160);
  };
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length >= 2) onBegin();
  };
  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length >= 2) onBegin();
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length < 2) onEnd();
  };

  map.events.add('actionbegin', onBegin);
  map.events.add('actionend', onEnd);
  map.events.add('multitouchstart', onBegin);
  map.events.add('multitouchend', onEnd);
  container?.addEventListener('touchstart', onTouchStart, { passive: true });
  container?.addEventListener('touchmove', onTouchMove, { passive: true });
  container?.addEventListener('touchend', onTouchEnd, { passive: true });
  container?.addEventListener('touchcancel', onEnd, { passive: true });

  return () => {
    try {
      map.events.remove('actionbegin', onBegin);
      map.events.remove('actionend', onEnd);
      map.events.remove('multitouchstart', onBegin);
      map.events.remove('multitouchend', onEnd);
    } catch {
      /* destroy */
    }
    if (endTimer !== null) window.clearTimeout(endTimer);
    container?.removeEventListener('touchstart', onTouchStart);
    container?.removeEventListener('touchmove', onTouchMove);
    container?.removeEventListener('touchend', onTouchEnd);
    container?.removeEventListener('touchcancel', onEnd);
    setMapGesturing(false);
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findTileLayer(root: any): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let found: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visit = (node: any) => {
    if (found || !node) return;
    const getUrl = node.getTileUrl ?? node.getTileUrl;
    if (typeof getUrl === 'function') {
      found = node;
      return;
    }
    if (typeof node.each === 'function') node.each(visit);
  };
  visit(root);
  if (!found && root && typeof root.get === 'function') visit(root.get(0));
  return found;
}

function tileUrlOf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layer: any,
  x: number,
  y: number,
  z: number,
): string | null {
  try {
    const getUrl = layer.getTileUrl ?? layer.getTileUrl;
    const url = getUrl?.call(layer, [x, y], z);
    return typeof url === 'string' && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

function loadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

function collectViewportTiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projection: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layer: any,
  lat: number,
  lng: number,
  zoom: number,
  width: number,
  height: number,
  urls: Set<string>,
  limit: number,
): void {
  const z = Math.round(zoom);
  if (z < 1 || z > 19 || urls.size >= limit) return;
  let px: number;
  let py: number;
  try {
    [px, py] = projection.toGlobalPixels([lat, lng], z) as [number, number];
  } catch {
    return;
  }
  const x1 = Math.floor((px - width / 2) / TILE_SIZE) - 1;
  const x2 = Math.floor((px + width / 2) / TILE_SIZE) + 1;
  const y1 = Math.floor((py - height / 2) / TILE_SIZE) - 1;
  const y2 = Math.floor((py + height / 2) / TILE_SIZE) + 1;
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      if (urls.size >= limit) return;
      const url = tileUrlOf(layer, x, y, z);
      if (url) urls.add(url);
    }
  }
}

/** Ждём, пока видимые тайлы реально отрисуются, а не только придут по HTTP. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function waitForVisibleTiles(map: any, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let stable = 0;
    let missingStatus = 0;
    let timer: number | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let layer: any = null;

    const finish = () => {
      if (done) return;
      done = true;
      if (timer !== null) window.clearInterval(timer);
      layer?.events?.remove?.('tileloadchange', check);
      resolve();
    };

    const check = () => {
      const next = findTileLayer(map?.layers);
      if (!next || typeof next.getTileStatus !== 'function') {
        missingStatus += 1;
        if (missingStatus >= 4) finish();
        return;
      }
      missingStatus = 0;
      if (next !== layer) {
        layer?.events?.remove?.('tileloadchange', check);
        layer = next;
        layer.events?.add?.('tileloadchange', check);
      }
      try {
        const status = layer.getTileStatus() as {
          readyTileNumber?: number;
          totalTileNumber?: number;
        };
        const ready = Number(status?.readyTileNumber ?? 0);
        const total = Number(status?.totalTileNumber ?? 0);
        if (total > 0 && ready >= total) {
          stable += 1;
          if (stable >= 2) finish();
        } else {
          stable = 0;
        }
      } catch {
        /* слой перестраивается */
      }
    };

    timer = window.setInterval(check, 120);
    window.setTimeout(finish, timeoutMs);
    window.setTimeout(check, 40);
  });
}

function pinLayoutClass(ymaps: { templateLayoutFactory: { createClass: (html: string) => unknown } }) {
  return ymaps.templateLayoutFactory.createClass(`
    <div class="map-pin map-pin--heart $[properties.activeClass] $[properties.fanClass]" style="$[properties.fanStyle]">
      <div class="map-pin__inner">
        <div class="map-pin__heart-wrap">
          <svg class="map-pin__heart-svg" viewBox="0 0 40 42" xmlns="http://www.w3.org/2000/svg">
            <path class="map-pin__heart-shape" d="M20 37 C20 37 5 25.5 5 15.5 C5 9.5 9.5 5 15.5 5 C18.5 5 20.5 7 20 9.5 C19.5 7 21.5 5 24.5 5 C30.5 5 35 9.5 35 15.5 C35 25.5 20 37 20 37 Z"/>
          </svg>
          <span class="map-pin__heart-num">$[properties.label]</span>
        </div>
      </div>
      <div class="map-pin__shadow"></div>
    </div>
  `);
}

export function MapCanvas({
  initialCenter,
  initialZoom,
  pins,
  onMapClick,
  onPinClick,
  ref,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ymapsRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pinLayoutRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placemarksRef = useRef<Map<string, any>>(new Map());
  /** Последние отрисованные данные пина — чтобы не трогать DOM зря во время анимации. */
  const pinStateRef = useRef<Map<string, string>>(new Map());
  /** Клик по любому сердечку веера → id верхней (видимая цифра). */
  const pinClickAliasRef = useRef<Map<string, string>>(new Map());
  /** URL тайлов, которые уже скачали — не гоняем сеть повторно. */
  const preloadedTilesRef = useRef<Set<string>>(new Set());
  const readyWaitersRef = useRef<Set<() => void>>(new Set());
  const flightGenRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touchMap, setTouchMap] = useState(false);

  const mapClickRef = useRef(onMapClick);
  mapClickRef.current = onMapClick;
  const pinClickRef = useRef(onPinClick);
  pinClickRef.current = onPinClick;
  const lastPinClickAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any = null;
    let detachDiag: (() => void) | null = null;
    let detachGestures: (() => void) | null = null;

    loadYmaps()
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;
        ymapsRef.current = ymaps;
        pinLayoutRef.current = pinLayoutClass(ymaps);

        const touchMap = prefersTouchMap();
        setTouchMap(touchMap);

        map = new ymaps.Map(
          containerRef.current,
          {
            center: [initialCenter.lat, initialCenter.lng],
            zoom: initialZoom,
            controls: [],
            behaviors: touchMap ? ['drag', 'multiTouch'] : ['drag', 'scrollZoom'],
          },
          {
            suppressMapOpenBlock: true,
            maxAnimationZoomDifference: 23,
            // На телефоне дробный зум при щипке — иначе зум «ступеньками».
            avoidFractionalZoom: false,
            yandexMapDisablePoiInteractivity: true,
          },
        );

        map.behaviors.disable('dblClickZoom');
        try {
          map.behaviors.get('drag')?.options.set({ inertia: true });
        } catch {
          /* штатная инерция и так включена */
        }
        if (touchMap) {
          try {
            map.behaviors.get('multiTouch')?.options.set({ tremor: 8 });
          } catch {
            /* pinch останется со стандартной чувствительностью */
          }
          map.behaviors.disable('scrollZoom');
        } else {
          try {
            map.behaviors.get('scrollZoom')?.options.set({
              speed: 1.6,
              maximumDelta: 2,
            });
          } catch {
            /* колёсико останется со скоростью по умолчанию */
          }
        }

        const DOUBLE_TAP_MS = 320;
        const DOUBLE_TAP_PX = 28;
        let lastTap = { time: 0, x: 0, y: 0 };

        const emitCoords = (coords: number[]) => {
          if (coords && mapClickRef.current) {
            mapClickRef.current({ lat: coords[0], lng: coords[1] });
          }
        };

        // Десктоп: двойной клик
        map.events.add('dblclick', (event: { get: (name: string) => number[] }) => {
          emitCoords(event.get('coords'));
          lastTap.time = 0;
        });

        // Телефон / Telegram: два быстрых тапа в одном месте
        map.events.add(
          'click',
          (event: { get: (name: string) => number[] }) => {
            if (!mapClickRef.current) return;
            if (Date.now() - lastPinClickAtRef.current < 500) return;
            const coords = event.get('coords');
            const pixel = event.get('pixel') ?? event.get('position');
            if (!coords || !pixel) return;

            const now = Date.now();
            const dx = pixel[0] - lastTap.x;
            const dy = pixel[1] - lastTap.y;
            const isDouble =
              now - lastTap.time < DOUBLE_TAP_MS &&
              dx * dx + dy * dy < DOUBLE_TAP_PX * DOUBLE_TAP_PX;

            if (isDouble) {
              emitCoords(coords);
              lastTap.time = 0;
            } else {
              lastTap = { time: now, x: pixel[0], y: pixel[1] };
            }
          },
        );

        mapRef.current = map;
        detachGestures = attachGestureHints(map, containerRef.current);
        if (import.meta.env.DEV) {
          detachDiag = attachTileDiagnostics(map, containerRef.current);
        }
        // Родительский Screen входит через transform/scale. После окончания
        // перехода Яндексу нужно повторно измерить настоящий viewport.
        window.requestAnimationFrame(() => map?.container.fitToViewport());
        window.setTimeout(() => map?.container.fitToViewport(), 550);
        readyWaitersRef.current.forEach((resolve) => resolve());
        readyWaitersRef.current.clear();
        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    const handleResize = () => mapRef.current?.container.fitToViewport();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      detachGestures?.();
      detachDiag?.();
      readyWaitersRef.current.forEach((resolve) => resolve());
      readyWaitersRef.current.clear();
      placemarksRef.current.clear();
      pinStateRef.current.clear();
      if (map) map.destroy();
      if (containerRef.current) containerRef.current.replaceChildren();
      mapRef.current = null;
      setTouchMap(false);
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;
    if (!map || !ymaps || !ready) return;

    const existing = placemarksRef.current;
    const wanted = new Map(pins.map((pin) => [pin.id, pin]));
    const layout = pinLayoutRef.current;
    const drawn = pinStateRef.current;

    for (const [id, placemark] of [...existing]) {
      if (!wanted.has(id)) {
        map.geoObjects.remove(placemark);
        existing.delete(id);
        drawn.delete(id);
      }
    }

    const applyPins = () => {
      const fans = computePinFans(map, pins);
      const aliases = pinClickAliasRef.current;
      aliases.clear();
      pins.forEach((pin) => {
        let placemark = existing.get(pin.id);
        const fan = fans.get(pin.id) ?? { angle: 0, x: 0, y: 0, z: 1000, clickId: pin.id, interactive: true };
        aliases.set(pin.id, fan.clickId);
        const props = {
          label: pin.label,
          activeClass: pin.active ? 'map-pin--active' : '',
          fanClass: fan.interactive ? 'map-pin--fan-top' : 'map-pin--fan-under',
          fanStyle: `--fan-angle:${fan.angle}deg;--fan-x:${fan.x.toFixed(1)}px;--fan-y:${fan.y.toFixed(1)}px;`,
        };
        const signature = `${pin.label}|${props.activeClass}|${props.fanClass}|${pin.lat}|${pin.lng}|${fan.angle}|${fan.x.toFixed(1)}|${fan.y.toFixed(1)}|${fan.clickId}|${fan.interactive}`;

        if (!placemark) {
          placemark = new ymaps.Placemark([pin.lat, pin.lng], props, {
            iconLayout: 'default#imageWithContent',
            iconImageHref:
              'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            iconImageSize: [PIN_W, PIN_H],
            iconImageOffset: [-PIN_W / 2, -PIN_H],
            iconContentOffset: [0, 0],
            iconContentLayout: layout,
            hasBalloon: false,
            hasHint: false,
            cursor: fan.interactive ? 'pointer' : 'default',
            zIndex: fan.z,
            zIndexHover: fan.z,
            interactivityModel: fan.interactive ? 'default#opaque' : 'default#silent',
          });
          const ownId = pin.id;
          placemark.events.add('click', (event: { stopPropagation: () => void }) => {
            event.stopPropagation();
            lastPinClickAtRef.current = Date.now();
            const target = pinClickAliasRef.current.get(ownId) ?? ownId;
            pinClickRef.current?.(target);
          });
          map.geoObjects.add(placemark);
          existing.set(pin.id, placemark);
        } else if (drawn.get(pin.id) !== signature) {
          placemark.geometry.setCoordinates([pin.lat, pin.lng]);
          placemark.properties.set(props);
          placemark.options.set({
            iconImageOffset: [-PIN_W / 2, -PIN_H],
            zIndex: fan.z,
            zIndexHover: fan.z,
            cursor: fan.interactive ? 'pointer' : 'default',
            interactivityModel: fan.interactive ? 'default#opaque' : 'default#silent',
          });
        }

        drawn.set(pin.id, signature);
      });
    };

    applyPins();

    let settleTimer: number | null = null;
    const settleFan = () => {
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        applyPins();
      }, 420);
    };
    const onActionBegin = () => {
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
        settleTimer = null;
      }
    };

    // Не трогаем веер, пока палец/колёсико двигают карту — иначе анимация и углы дёргаются.
    map.events.add('actionbegin', onActionBegin);
    map.events.add('actionend', settleFan);

    return () => {
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      map.events.remove('actionbegin', onActionBegin);
      map.events.remove('actionend', settleFan);
    };
  }, [pins, ready]);

  useImperativeHandle(
    ref,
    () => ({
      async waitUntilReady() {
        if (!mapRef.current) {
          await new Promise<void>((resolve) => readyWaitersRef.current.add(resolve));
        }
        const map = mapRef.current;
        if (!map) return;
        map.container?.fitToViewport?.();
        await waitForVisibleTiles(map, FIRST_TILES_TIMEOUT_MS);
      },
      async preloadRoute(lat: number, lng: number, zoom = 15) {
        const map = mapRef.current;
        if (!map) return;
        try {
          const projection = map.options.get('projection');
          const layer = findTileLayer(map.layers);
          if (!projection || !layer) return;

          const [fromLat, fromLng] = map.getCenter() as [number, number];
          const fromZoom = Number(map.getZoom?.() ?? zoom);
          const [width, height] = map.container.getSize() as [number, number];
          const urls = new Set<string>();

          const steps = 5;
          for (let step = 0; step <= steps; step++) {
            const t = step / steps;
            const sampleLat = fromLat + (lat - fromLat) * t;
            const sampleLng = fromLng + (lng - fromLng) * t;
            const sampleZoom = fromZoom + (zoom - fromZoom) * t;
            collectViewportTiles(
              projection,
              layer,
              sampleLat,
              sampleLng,
              sampleZoom,
              width,
              height,
              urls,
              PRELOAD_MAX_TILES,
            );
            const low = Math.floor(sampleZoom);
            const high = Math.ceil(sampleZoom);
            if (low !== Math.round(sampleZoom)) {
              collectViewportTiles(
                projection,
                layer,
                sampleLat,
                sampleLng,
                low,
                width,
                height,
                urls,
                PRELOAD_MAX_TILES,
              );
            }
            if (high !== low && high !== Math.round(sampleZoom)) {
              collectViewportTiles(
                projection,
                layer,
                sampleLat,
                sampleLng,
                high,
                width,
                height,
                urls,
                PRELOAD_MAX_TILES,
              );
            }
          }

          logTile('PRELOAD_URLS', {
            count: urls.size,
            sample: [...urls].slice(0, 2),
            from: [fromLat, fromLng],
            to: [lat, lng],
            fromZoom,
            zoom,
            size: [width, height],
          });

          const cache = preloadedTilesRef.current;
          const jobs: Promise<void>[] = [];
          for (const url of urls) {
            if (cache.has(url)) continue;
            cache.add(url);
            jobs.push(
              loadImage(url).catch(() => {
                cache.delete(url);
              }),
            );
            if (jobs.length >= PRELOAD_MAX_TILES) break;
          }
          if (jobs.length === 0) return;

          await Promise.race([
            Promise.all(jobs).then(() => undefined),
            new Promise<void>((resolve) => window.setTimeout(resolve, PRELOAD_TIMEOUT_MS)),
          ]);
        } catch {
          /* предзагрузка не должна ломать сценарий */
        }
      },
      cancelFlight() {
        flightGenRef.current += 1;
        const map = mapRef.current;
        try {
          map?.action?.getCurrent?.()?.stop?.();
        } catch {
          /* карта могла уже остановиться */
        }
      },
      async flyTo(lat: number, lng: number, zoom = 15, duration = 1600) {
        const map = mapRef.current;
        const ymaps = ymapsRef.current;
        if (!map) return;
        const flightGen = ++flightGenRef.current;
        const stillFlying = () => flightGen === flightGenRef.current;

        const from = (map.getCenter?.() as [number, number] | undefined) ?? [lat, lng];
        const fromZoom = Number(map.getZoom?.() ?? zoom);
        const targetZoom = Math.round(zoom);
        const dest: [number, number] = [lat, lng];
        const size = map.container?.getSize?.();
        const nearby = isNearbyFlight(map, from, dest, fromZoom);
        const sameSpot = pixelDistance(map, from, dest, fromZoom) < 12;
        const animDuration = Math.max(800, Number(duration) || 1200);
        const startedAt = performance.now();
        const w = tileWindow();
        const flight: TileFlight = {
          id: (w.__mapTileFlight?.id ?? 0) + 1,
          mapTileload: 0,
          mapTileerror: 0,
          layerTileload: 0,
          layerTileerror: 0,
          tileloadchange: 0,
          readyMin: Number.POSITIVE_INFINITY,
          readyMax: 0,
          totalMax: 0,
          incompleteTicks: 0,
          sizeChanges: 0,
        };
        w.__mapTileFlight = flight;
        logTile('FLY_START', {
          lat,
          lng,
          zoom: targetZoom,
          from,
          fromZoom,
          nearby,
          sameSpot,
          duration: animDuration,
          size,
        });

        try {
          if (sameSpot && Math.abs(fromZoom - targetZoom) <= 0.2) {
            await waitForVisibleTiles(map, FIRST_TILES_TIMEOUT_MS);
            return;
          }

          if (nearby) {
            const zoomDiff = Math.abs(fromZoom - targetZoom);
            if (zoomDiff > 0.2) {
              await waitForAnimation(
                map.setCenter(dest, targetZoom, {
                  duration: animDuration,
                  timingFunction: 'ease-in-out',
                }),
                animDuration,
              );
            } else {
              await waitForAnimation(
                map.panTo(dest, {
                  duration: animDuration,
                  timingFunction: 'ease-in-out',
                  flying: false,
                  safe: false,
                }),
                animDuration,
              );
            }
            if (!stillFlying()) return;
            await waitForVisibleTiles(map, FIRST_TILES_TIMEOUT_MS);
            return;
          }

          // Далеко: расширение на месте → перелёт на широком зуме → приближение к точке.
          const overview = ymaps
            ? overviewForFlight(ymaps, map, from, dest, fromZoom, targetZoom)
            : { center: dest, zoom: Math.max(3, targetZoom - 6) };
          const wideZoom = overview.zoom;
          const outMs = Math.max(700, Math.round(animDuration * 0.35));
          const panMs = Math.max(900, Math.round(animDuration * 0.5));
          const inMs = Math.max(1000, Math.round(animDuration * 0.55));

          if (fromZoom > wideZoom + 0.2) {
            logTile('FLY_OUT', { center: from, zoom: wideZoom, outMs });
            await waitForAnimation(
              map.setCenter(from, wideZoom, {
                duration: outMs,
                timingFunction: 'ease-in-out',
              }),
              outMs,
            );
            if (!stillFlying()) return;
            await waitForVisibleTiles(map, 6000);
            if (!stillFlying()) return;
            logTile('FLY_OUT_READY', { zoom: map.getZoom?.(), center: map.getCenter?.() });
            await sleep(FLIGHT_STAGE_HOLD_MS);
            if (!stillFlying()) return;
          }

          logTile('FLY_PAN', { dest, zoom: wideZoom, panMs });
          await waitForAnimation(
            map.panTo(dest, {
              duration: panMs,
              timingFunction: 'ease-in-out',
              flying: false,
              safe: false,
            }),
            panMs,
          );
          if (!stillFlying()) return;
          await waitForVisibleTiles(map, 8000);
          if (!stillFlying()) return;
          await sleep(FLIGHT_STAGE_HOLD_MS);
          if (!stillFlying()) return;

          logTile('FLY_IN', { dest, zoom: targetZoom, inMs });
          await waitForAnimation(
            map.setCenter(dest, targetZoom, {
              duration: inMs,
              timingFunction: 'ease-in-out',
            }),
            inMs,
          );
          if (!stillFlying()) return;
          await waitForVisibleTiles(map, FIRST_TILES_TIMEOUT_MS);
        } finally {
          logTile('FLY_END', {
            elapsedMs: Math.round(performance.now() - startedAt),
            duration: animDuration,
            nearby,
            zoom: map.getZoom?.(),
            center: map.getCenter?.(),
            size: map.container?.getSize?.(),
            tileloadchange: flight.tileloadchange,
            readyMin: Number.isFinite(flight.readyMin) ? flight.readyMin : null,
            readyMax: flight.readyMax,
            totalMax: flight.totalMax,
            incompleteTicks: flight.incompleteTicks,
          });
          w.__mapTileFlight = null;
        }
      },
      fitAll(points, duration = 1400) {
        const map = mapRef.current;
        const ymaps = ymapsRef.current;
        if (!map || !ymaps || points.length === 0) return;
        if (points.length === 1) {
          map.setCenter([points[0].lat, points[0].lng], 14, {
            duration,
            timingFunction: 'ease-in-out',
          });
          return;
        }
        const bounds = ymaps.util.bounds.fromPoints(points.map((p) => [p.lat, p.lng]));
        map.setBounds(bounds, {
          duration,
          timingFunction: 'ease-in-out',
          checkZoomRange: true,
          zoomMargin: 48,
        });
      },
    }),
    [],
  );

  return (
    <div className={touchMap ? 'map-canvas map-canvas--touch' : 'map-canvas'}>
      <div ref={containerRef} className="map-canvas__map" />
      {!touchMap && <div className="map-canvas__tint" aria-hidden="true" />}
      {error && (
        <div className="map-canvas__error">
          <p>Карта не загрузилась</p>
          <span>{error}</span>
          <ol className="map-canvas__error-steps">
            <li>
              Откройте сайт как <code>http://localhost:5173</code> (не 127.0.0.1)
            </li>
            <li>
              В ключе Яндекса в Referer должно быть только <code>localhost</code>
            </li>
            <li>
              Ключ в <code>frontend/.env</code> → перезапуск <code>npm run dev</code>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
