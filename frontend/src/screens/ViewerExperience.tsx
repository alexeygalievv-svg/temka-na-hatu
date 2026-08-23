import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { IntroSettings, MemoryPoint } from '../types';
import { haptic } from '../telegram';
import { MapCanvas, type MapHandle } from '../components/MapCanvas';
import { MemoryCard } from '../components/MemoryCard';
import { Button } from '../components/Button';
import { IntroOverlay } from '../components/IntroOverlay';

type Stage = 'intro' | 'reveal' | 'explore';

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

interface SpeedStreak {
  id: string;
  y: number;
  length: number;
  height: number;
  opacity: number;
  delay: number;
  startX: number;
}

function buildStreaks(seed: number): SpeedStreak[] {
  return Array.from({ length: 46 }, (_, i) => {
    const n = (i * 37 + seed * 19) % 97;
    return {
      id: `${seed}-${i}`,
      y: 2 + (i / 45) * 96 + ((n % 9) - 4),
      length: 42 + (n % 78),
      height: 2 + (n % 8),
      opacity: 0.42 + (n % 48) / 100,
      delay: (n % 90) / 1000,
      startX: -38 + (n % 26),
    };
  });
}

function movementAngle(from: MemoryPoint | null, to: MemoryPoint): number {
  if (!from) return -8;
  const dx = to.lng - from.lng;
  const dy = -(to.lat - from.lat);
  if (Math.abs(dx) + Math.abs(dy) < 0.000001) return -8;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function SpeedStreakOverlay({ angle, streaks }: { angle: number; streaks: SpeedStreak[] }) {
  return (
    <motion.div
      className="viewer__speed-overlay"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12, ease: 'linear' }}
    >
      <div className="viewer__speed-wash" />
      <div className="viewer__speed-field" style={{ transform: `rotate(${angle}deg)` }}>
        {streaks.map((streak) => (
          <motion.span
            key={streak.id}
            className="viewer__speed-line"
            style={{
              top: `${streak.y}%`,
              width: `${streak.length}vw`,
              height: streak.height,
            }}
            initial={{
              x: `${streak.startX}vw`,
              opacity: 0,
              scaleX: 0.35,
            }}
            animate={{
              x: [`${streak.startX}vw`, `${streak.startX + 72}vw`, `${streak.startX + 168}vw`],
              opacity: [0, streak.opacity, streak.opacity, 0],
              scaleX: [0.45, 1.35, 1.7],
            }}
            transition={{
              duration: 0.58,
              delay: streak.delay,
              times: [0, 0.22, 0.62, 1],
              ease: [0.12, 0.82, 0.18, 1],
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

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
  const [speedTransition, setSpeedTransition] = useState(false);
  const [speedAngle, setSpeedAngle] = useState(-8);
  const [speedKey, setSpeedKey] = useState(0);
  const streaks = useMemo(() => buildStreaks(speedKey), [speedKey]);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  async function startReveal() {
    // На холодном устройстве SDK и первый слой карты могут загружаться дольше
    // данных карты. Интро остаётся на экране, пока ymaps.Map не готов.
    await mapRef.current?.waitUntilReady();
    if (cancelledRef.current) return;
    setStage('reveal');
    haptic('medium');

    for (let i = 0; i < points.length; i++) {
      if (cancelledRef.current) return;
      setCurrentIndex(i);

      setSpeedAngle(movementAngle(i > 0 ? points[i - 1] : null, points[i]));
      setSpeedKey((key) => key + 1);
      setSpeedTransition(true);
      await sleep(120);
      if (cancelledRef.current) return;

      await mapRef.current?.jumpTo(points[i].lat, points[i].lng, 15.3, 280);
      if (cancelledRef.current) return;

      await sleep(360);
      setSpeedTransition(false);
      await sleep(180);
      if (cancelledRef.current) return;

      setVisibleCount(i + 1);
      haptic('light');
      await sleep(1000);
    }
    if (cancelledRef.current) return;
    setCurrentIndex(-1);
    if (points.length > 1) {
      await mapRef.current?.fitAll(points, 950);
      await sleep(500);
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
    <div className={`viewer${speedTransition ? ' viewer--speed-transition' : ''}`}>
      <MapCanvas
        ref={mapRef}
        initialCenter={points[0] ?? { lat: 55.7512, lng: 37.6184 }}
        initialZoom={10}
        pins={pins}
        onPinClick={(id) => {
          if (stage !== 'explore') return;
          haptic('light');
          setActiveId(id);
        }}
      />

      <AnimatePresence>
        {speedTransition && (
          <SpeedStreakOverlay key={speedKey} angle={speedAngle} streaks={streaks} />
        )}
      </AnimatePresence>

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
              pointCount={points.length}
              onOpen={startReveal}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Подпись текущей точки во время «путешествия» */}
      <AnimatePresence mode="wait">
        {stage === 'reveal' && currentIndex >= 0 && !speedTransition && (
          <motion.div
            key={currentIndex}
            className="viewer__caption"
            initial={{ opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <span className="viewer__caption-num">{currentIndex + 1}</span>
            <span className="viewer__caption-title">
              {points[currentIndex].title || `Место ${currentIndex + 1}`}
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
        {stage === 'explore' && !activeId && (
          <motion.div
            className="viewer__explore-hint"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ delay: 0.4, duration: 0.5 }}
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
