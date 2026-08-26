import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { IntroSettings, MemoryPoint } from '../types';
import { haptic } from '../telegram';
import { MapCanvas, type MapHandle } from '../components/MapCanvas';
import { MemoryCard } from '../components/MemoryCard';
import { Button } from '../components/Button';
import { IntroOverlay } from '../components/IntroOverlay';
import { PlaceDate } from '../components/PlaceDate';

type Stage = 'intro' | 'tour' | 'explore';
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
const TOUR_STAGE_HOLD_MS = 1000;
const WIDE_ZOOM = 10;
const CLOSE_ZOOM = 15;
const HOLD_WIDE_MS = TOUR_STAGE_HOLD_MS;
const HOLD_AFTER_ARRIVE_MS = TOUR_STAGE_HOLD_MS;

/**
 * Экран получателя: интро → по очереди подлёт к месту и карточка → свободная карта.
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
  const tourGenRef = useRef(0);
  const [stage, setStage] = useState<Stage>('intro');
  const [visibleCount, setVisibleCount] = useState(0);
  const [tourIndex, setTourIndex] = useState(0);
  const [cardOpen, setCardOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hintPhase, setHintPhase] = useState<HintPhase>('idle');

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

  async function finishTour() {
    tourGenRef.current += 1;
    setCardOpen(false);
    setActiveId(null);
    setVisibleCount(points.length);
    setStage('explore');
    haptic('medium');
    mapRef.current?.cancelFlight();
    if (points.length > 0) mapRef.current?.fitAll(points, 900);
  }

  async function skipTour() {
    haptic('soft');
    await mapRef.current?.waitUntilReady();
    await finishTour();
  }

  async function showStop(index: number) {
    const point = points[index];
    if (!point) {
      await finishTour();
      return;
    }
    const gen = ++tourGenRef.current;
    setCardOpen(false);
    setActiveId(null);
    setTourIndex(index);
    setVisibleCount((count) => Math.max(count, index + 1));
    setStage('tour');

    await sleep(index === 0 ? 80 : 280);
    await mapRef.current?.waitUntilReady();
    if (gen !== tourGenRef.current) return;
    if (index === 0) {
      await sleep(HOLD_WIDE_MS);
      if (gen !== tourGenRef.current) return;
    }
    await mapRef.current?.preloadRoute(point.lat, point.lng, CLOSE_ZOOM);
    if (gen !== tourGenRef.current) return;
    await mapRef.current?.flyTo(point.lat, point.lng, CLOSE_ZOOM, 1700);
    if (gen !== tourGenRef.current) return;
    await sleep(HOLD_AFTER_ARRIVE_MS);
    if (gen !== tourGenRef.current) return;
    setCardOpen(true);
    haptic('medium');
    const next = points[index + 1];
    if (next) void mapRef.current?.preloadRoute(next.lat, next.lng, CLOSE_ZOOM);
  }

  async function startTour() {
    haptic('medium');
    await mapRef.current?.waitUntilReady();
    await showStop(0);
  }

  function goNext() {
    if (tourIndex >= points.length - 1) {
      void finishTour();
      return;
    }
    void showStop(tourIndex + 1);
  }

  const shownPoints = stage === 'intro' ? [] : points.slice(0, visibleCount);
  const tourPoint = points[tourIndex] ?? null;
  const activePoint =
    stage === 'tour'
      ? cardOpen
        ? tourPoint
        : null
      : points.find((point) => point.id === activeId) ?? null;
  const activeIndex = activePoint ? points.indexOf(activePoint) : -1;
  const lastStop = tourIndex >= points.length - 1;

  const pins = useMemo(
    () =>
      shownPoints.map((point, i) => ({
        id: point.id,
        lat: point.lat,
        lng: point.lng,
        label: String(i + 1),
        active: stage === 'tour' ? i === tourIndex : point.id === activeId,
      })),
    [shownPoints, stage, tourIndex, activeId],
  );

  return (
    <div className="viewer">
      <MapCanvas
        ref={mapRef}
        initialCenter={points[0] ?? { lat: 55.7512, lng: 37.6184 }}
        initialZoom={WIDE_ZOOM}
        pins={pins}
        onPinClick={(id) => {
          if (stage !== 'explore') return;
          haptic('light');
          setHintPhase('dock');
          setActiveId(id);
        }}
      />

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
              onOpen={startTour}
            />
            {onExit && (
              <button type="button" className="viewer__skip" onClick={() => void skipTour()}>
                Пропустить
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {stage === 'tour' && (
        <button type="button" className="viewer__skip" onClick={() => void skipTour()}>
          Пропустить
        </button>
      )}

      <AnimatePresence mode="wait">
        {stage === 'tour' && !cardOpen && tourPoint && (
          <motion.div
            key={tourPoint.id}
            className="viewer__caption"
            initial={{ opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <span className="viewer__caption-num">{tourIndex + 1}</span>
            <span className="viewer__caption-copy">
              <span className="viewer__caption-title">
                {tourPoint.title || `Место ${tourIndex + 1}`}
              </span>
              <PlaceDate value={tourPoint.happenedOn} className="place-date--caption" />
            </span>
          </motion.div>
        )}
      </AnimatePresence>

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
              <span className="viewer__nudge-pin">
                <svg className="map-pin__heart-svg" viewBox="0 0 40 42" xmlns="http://www.w3.org/2000/svg">
                  <path
                    className="map-pin__heart-shape"
                    d="M20 37 C20 37 5 25.5 5 15.5 C5 9.5 9.5 5 15.5 5 C18.5 5 20.5 7 20 9.5 C19.5 7 21.5 5 24.5 5 C30.5 5 35 9.5 35 15.5 C35 25.5 20 37 20 37 Z"
                  />
                </svg>
                <span className="map-pin__shadow" />
              </span>
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
        dismissible={stage === 'explore'}
        nextLabel={stage === 'tour' ? (lastStop ? 'Смотреть карту' : 'Далее') : undefined}
        onNext={stage === 'tour' ? goNext : undefined}
        onClose={() => setActiveId(null)}
      />
    </div>
  );
}
