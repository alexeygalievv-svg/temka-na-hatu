import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { IntroSettings, MemoryPoint } from '../types';
import { haptic } from '../telegram';
import { MapCanvas, type MapHandle } from '../components/MapCanvas';
import { MemoryCard } from '../components/MemoryCard';
import { Button } from '../components/Button';
import { IntroOverlay } from '../components/IntroOverlay';
import { PlaceDate } from '../components/PlaceDate';

type Stage = 'intro' | 'reveal' | 'explore';
type HintPhase = 'idle' | 'center' | 'dock';

interface ViewerExperienceProps {
  title: string;
  authorName: string | null;
  intro: IntroSettings;
  points: MemoryPoint[];
  /** Кнопка выхода (используется в предпросмотре). */
  onExit?: () => void;
  exitLabel?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Экран получателя: интро → анимированное «путешествие» камеры по точкам
 * с поочерёдным появлением пинов → свободное исследование карты.
 */
export function ViewerExperience({
  title,
  authorName,
  intro,
  points,
  onExit,
  exitLabel,
}: ViewerExperienceProps) {
  const mapRef = useRef<MapHandle>(null);
  const cancelledRef = useRef(false);
  const [stage, setStage] = useState<Stage>('intro');
  const [visibleCount, setVisibleCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hintPhase, setHintPhase] = useState<HintPhase>('idle');

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (stage !== 'explore') {
      setHintPhase('idle');
      return;
    }
    const showCenter = window.setTimeout(() => setHintPhase('center'), 400);
    const showDock = window.setTimeout(() => setHintPhase('dock'), 3200);
    return () => {
      window.clearTimeout(showCenter);
      window.clearTimeout(showDock);
    };
  }, [stage]);

  async function skipReveal() {
    cancelledRef.current = true;
    haptic('soft');
    await mapRef.current?.waitUntilReady();
    mapRef.current?.cancelFlight();
    setVisibleCount(points.length);
    setCurrentIndex(-1);
    setStage('explore');
    if (points.length > 0) {
      mapRef.current?.fitAll(points, 700);
    }
  }

  async function startReveal() {
    // На холодном устройстве SDK и первый слой карты могут загружаться дольше
    // данных карты. Интро остаётся на экране, пока ymaps.Map не готов.
    await mapRef.current?.waitUntilReady();
    if (cancelledRef.current) return;
    if (points[0]) {
      await mapRef.current?.preloadRoute(points[0].lat, points[0].lng, 15);
    }
    if (cancelledRef.current) return;
    setStage('reveal');
    haptic('medium');

    for (let i = 0; i < points.length; i++) {
      if (cancelledRef.current) return;
      setCurrentIndex(i);
      await mapRef.current?.flyTo(points[i].lat, points[i].lng, 15, 1700);
      if (cancelledRef.current) return;
      setVisibleCount(i + 1);
      haptic('light');
      const next = points[i + 1];
      await Promise.all([
        sleep(1250),
        next
          ? mapRef.current?.preloadRoute(next.lat, next.lng, 15) ?? Promise.resolve()
          : Promise.resolve(),
      ]);
    }
    if (cancelledRef.current) return;
    setCurrentIndex(-1);
    if (points.length > 1) {
      const midLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
      const midLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
      await mapRef.current?.preloadRoute(midLat, midLng, 11);
      if (cancelledRef.current) return;
      mapRef.current?.fitAll(points, 1500);
      await sleep(1600);
    }
    if (cancelledRef.current) return;
    setStage('explore');
  }

  const shownPoints = stage === 'explore' ? points : points.slice(0, visibleCount);
  const activePoint = points.find((p) => p.id === activeId) ?? null;
  const activeIndex = activePoint ? points.indexOf(activePoint) : -1;

  // Без мемоизации новый массив на каждый рендер заставлял карту
  // переставлять все метки прямо во время перелёта.
  const pins = useMemo(
    () =>
      shownPoints.map((p, i) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        label: String(i + 1),
        active: p.id === activeId,
      })),
    [shownPoints, activeId],
  );

  return (
    <div className="viewer">
      <MapCanvas
        ref={mapRef}
        initialCenter={points[0] ?? { lat: 55.7512, lng: 37.6184 }}
        initialZoom={15}
        pins={pins}
        onPinClick={(id) => {
          if (stage !== 'explore') return;
          haptic('light');
          setHintPhase('dock');
          setActiveId(id);
        }}
      />

      {/* Интро-занавес */}
      <AnimatePresence>
        {stage === 'intro' && (
          <motion.div
            className="viewer__intro"
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <IntroOverlay
              title={title}
              authorName={authorName}
              eyebrow={intro.eyebrow}
              message={intro.message}
              buttonText={intro.buttonText}
              photoPreview={intro.photoPreview}
              pointCount={points.length}
              onOpen={startReveal}
            />
            {onExit && (
              <button type="button" className="viewer__skip" onClick={() => void skipReveal()}>
                Пропустить
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {stage === 'reveal' && (
        <button type="button" className="viewer__skip" onClick={() => void skipReveal()}>
          Пропустить
        </button>
      )}

      {/* Подпись текущей точки во время «путешествия» */}
      <AnimatePresence mode="wait">
        {stage === 'reveal' && currentIndex >= 0 && (
          <motion.div
            key={currentIndex}
            className="viewer__caption"
            initial={{ opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <span className="viewer__caption-num">{currentIndex + 1}</span>
            <span className="viewer__caption-copy">
              <span className="viewer__caption-title">
                {points[currentIndex].title || `Место ${currentIndex + 1}`}
              </span>
              <PlaceDate value={points[currentIndex].happenedOn} className="place-date--caption" />
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Шапка и подсказка после раскрытия */}
      <AnimatePresence>
        {stage === 'explore' && (
          <motion.header
            className="viewer__topbar"
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="viewer__topbar-info">
              <h2>{title}</h2>
              {authorName && <span>от {authorName}</span>}
            </div>
            {onExit && (
              <Button variant="ghost" onClick={onExit}>
                {exitLabel ?? 'Назад'}
              </Button>
            )}
          </motion.header>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage === 'explore' && hintPhase === 'center' && !activeId && (
          <motion.div
            className="viewer__nudge"
            initial={{ opacity: 0, scale: 0.86, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -10 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="viewer__nudge-icon" aria-hidden="true">
              <svg viewBox="0 0 40 42">
                <path d="M20 37 C20 37 5 25.5 5 15.5 C5 9.5 9.5 5 15.5 5 C18.5 5 20.5 7 20 9.5 C19.5 7 21.5 5 24.5 5 C30.5 5 35 9.5 35 15.5 C35 25.5 20 37 20 37 Z" />
              </svg>
            </span>
            <p>Нажимайте на точки, чтобы открыть воспоминания</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage === 'explore' && hintPhase === 'dock' && !activeId && (
          <motion.div
            className="viewer__explore-hint"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            Нажимайте на точки, чтобы открыть воспоминания
          </motion.div>
        )}
      </AnimatePresence>

      <MemoryCard
        point={activePoint}
        index={activeIndex}
        total={points.length}
        onClose={() => setActiveId(null)}
      />
    </div>
  );
}
