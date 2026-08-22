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
const PIN_W = 38;
const PIN_H = 50;

function pinLayoutClass(ymaps: { templateLayoutFactory: { createClass: (html: string) => unknown } }) {
  return ymaps.templateLayoutFactory.createClass(`
    <div class="map-pin $[properties.activeClass]">
      <div class="map-pin__inner">
        <div class="map-pin__bubble"><span>$[properties.label]</span></div>
        <div class="map-pin__leg"></div>
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

    for (const [id, placemark] of [...existing]) {
      if (!wanted.has(id)) {
        map.geoObjects.remove(placemark);
        existing.delete(id);
      }
    }

    pins.forEach((pin) => {
      let placemark = existing.get(pin.id);
      const props = {
        label: pin.label,
        activeClass: pin.active ? 'map-pin--active' : '',
      };

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
      } else {
        placemark.geometry.setCoordinates([pin.lat, pin.lng]);
        placemark.properties.set(props);
      }
    });
  }, [pins, ready]);

  useImperativeHandle(
    ref,
    () => ({
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
