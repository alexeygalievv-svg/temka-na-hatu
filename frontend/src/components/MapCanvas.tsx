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
  flyTo: (lat: number, lng: number, zoom?: number, duration?: number) => Promise<void>;
  fitAll: (points: Array<{ lat: number; lng: number }>, duration?: number) => Promise<void>;
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

/**
 * Мягкое ускорение и долгое затухание. Яндекс принимает те же значения,
 * что CSS transition-timing-function, поэтому cubic-bezier допустим.
 */
const CAMERA_EASE = 'cubic-bezier(0.32, 0, 0.22, 1)';

const debugCamera = (label: string, payload: Record<string, unknown>) => {
  if (import.meta.env.DEV) console.log(`[map-camera] ${label}`, payload);
};

/** Ждём не меньше duration: промис Яндекса часто резолвится сразу и обрывал анимацию. */
function waitForAnimation(animation: unknown, minMs: number): Promise<void> {
  const minWait = new Promise<void>((resolve) => window.setTimeout(resolve, minMs));
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
        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
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
      async flyTo(lat: number, lng: number, zoom = 15, duration = 1200) {
        const map = mapRef.current;
        if (!map) return;

        const safeDuration = Math.max(800, duration);
        const started = performance.now();
        const currentZoom = Number(map.getZoom?.() ?? zoom);
        const zoomDiffers = Math.abs(currentZoom - zoom) > 0.15;
        const method = zoomDiffers ? 'setCenter' : 'panTo';

        debugCamera('start', { method, lat, lng, zoom, duration: safeDuration });

        // flying: false — иначе на средних расстояниях Яндекс отъезжает зумом
        // и возвращается обратно, и это читается как рывок.
        const animation = zoomDiffers
          ? map.setCenter([lat, lng], zoom, {
              duration: safeDuration,
              timingFunction: CAMERA_EASE,
            })
          : map.panTo([[lat, lng]], {
              duration: safeDuration,
              flying: false,
              safe: false,
              timingFunction: CAMERA_EASE,
            });

        await waitForAnimation(animation, safeDuration + 60);
        debugCamera('end', { method, elapsed: Math.round(performance.now() - started) });
      },
      async fitAll(points, duration = 1400) {
        const map = mapRef.current;
        const ymaps = ymapsRef.current;
        if (!map || !ymaps || points.length === 0) return;
        const safeDuration = Math.max(800, duration);
        const started = performance.now();
        debugCamera('fitAll start', { duration: safeDuration });

        const animation =
          points.length === 1
            ? map.panTo([[points[0].lat, points[0].lng]], {
                duration: safeDuration,
                flying: false,
                safe: false,
                timingFunction: CAMERA_EASE,
              })
            : map.setBounds(ymaps.util.bounds.fromPoints(points.map((p) => [p.lat, p.lng])), {
                duration: safeDuration,
                timingFunction: CAMERA_EASE,
                // checkZoomRange делает сетевой запрос перед движением — это заметная задержка.
                checkZoomRange: false,
                zoomMargin: 48,
              });

        await waitForAnimation(animation, safeDuration + 60);
        debugCamera('fitAll end', { elapsed: Math.round(performance.now() - started) });
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
