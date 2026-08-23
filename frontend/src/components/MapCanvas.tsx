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
  flyTo: (lat: number, lng: number, zoom?: number, duration?: number) => void;
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

const TILE_SIZE = 256;
const PRELOAD_TIMEOUT_MS = 4000;
const PRELOAD_MAX_TILES = 96;
const FIRST_TILES_TIMEOUT_MS = 5000;

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
    <div class="map-pin map-pin--heart $[properties.activeClass]">
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
  /** URL тайлов, которые уже скачали — не гоняем сеть повторно. */
  const preloadedTilesRef = useRef<Set<string>>(new Set());
  const readyWaitersRef = useRef<Set<() => void>>(new Set());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapClickRef = useRef(onMapClick);
  mapClickRef.current = onMapClick;
  const pinClickRef = useRef(onPinClick);
  pinClickRef.current = onPinClick;

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any = null;

    loadYmaps()
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;
        ymapsRef.current = ymaps;
        pinLayoutRef.current = pinLayoutClass(ymaps);

        map = new ymaps.Map(
          containerRef.current,
          {
            center: [initialCenter.lat, initialCenter.lng],
            zoom: initialZoom,
            controls: [],
          },
          { suppressMapOpenBlock: true },
        );

        map.behaviors.disable('dblClickZoom');

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
      readyWaitersRef.current.forEach((resolve) => resolve());
      readyWaitersRef.current.clear();
      placemarksRef.current.clear();
      pinStateRef.current.clear();
      if (map) map.destroy();
      if (containerRef.current) containerRef.current.replaceChildren();
      mapRef.current = null;
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

    pins.forEach((pin) => {
      let placemark = existing.get(pin.id);
      const props = {
        label: pin.label,
        activeClass: pin.active ? 'map-pin--active' : '',
      };
      const signature = `${pin.label}|${props.activeClass}|${pin.lat}|${pin.lng}`;

      if (!placemark) {
        placemark = new ymaps.Placemark([pin.lat, pin.lng], props, {
          iconLayout: 'default#imageWithContent',
          iconImageHref:
            'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          // Нижний центр пина = точка на карте (без двойного смещения в CSS)
          iconImageSize: [PIN_W, PIN_H],
          iconImageOffset: [-PIN_W / 2, -PIN_H],
          iconContentOffset: [0, 0],
          iconContentLayout: layout,
          hasBalloon: false,
          hasHint: false,
          zIndex: 1000,
          // Не пересчитывать позицию при зуме как DOM-элемент
          interactivityModel: 'default#opaque',
        });
        placemark.events.add('click', (event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          pinClickRef.current?.(pin.id);
        });
        map.geoObjects.add(placemark);
        existing.set(pin.id, placemark);
      } else if (drawn.get(pin.id) !== signature) {
        placemark.geometry.setCoordinates([pin.lat, pin.lng]);
        placemark.properties.set(props);
      }

      drawn.set(pin.id, signature);
    });
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
      flyTo(lat: number, lng: number, zoom = 15, duration = 1600) {
        mapRef.current?.setCenter([lat, lng], zoom, {
          duration,
          timingFunction: 'ease-in-out',
        });
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
    <div className="map-canvas">
      <div ref={containerRef} className="map-canvas__map" />
      <div className="map-canvas__tint" aria-hidden="true" />
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
