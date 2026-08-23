import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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

const SPEED_STREAKS = [
  { y: 7, x: -18, len: 28, h: 1.4, opacity: 0.36, delay: 0 },
  { y: 12, x: 36, len: 42, h: 2.2, opacity: 0.48, delay: 34 },
  { y: 18, x: -42, len: 68, h: 2.8, opacity: 0.55, delay: 66 },
  { y: 23, x: 18, len: 24, h: 1.3, opacity: 0.3, delay: 112 },
  { y: 29, x: -10, len: 54, h: 2.4, opacity: 0.5, delay: 26 },
  { y: 34, x: 48, len: 76, h: 3.2, opacity: 0.58, delay: 78 },
  { y: 40, x: -34, len: 36, h: 1.7, opacity: 0.38, delay: 126 },
  { y: 46, x: 10, len: 88, h: 3.4, opacity: 0.62, delay: 44 },
  { y: 51, x: -50, len: 58, h: 2.5, opacity: 0.46, delay: 92 },
  { y: 57, x: 28, len: 32, h: 1.5, opacity: 0.34, delay: 150 },
  { y: 63, x: -24, len: 96, h: 3.6, opacity: 0.64, delay: 18 },
  { y: 68, x: 44, len: 48, h: 2.1, opacity: 0.44, delay: 104 },
  { y: 74, x: -12, len: 72, h: 2.8, opacity: 0.52, delay: 58 },
  { y: 80, x: 22, len: 26, h: 1.4, opacity: 0.32, delay: 136 },
  { y: 86, x: -40, len: 62, h: 2.6, opacity: 0.48, delay: 8 },
] as const;

function movementAngle(from: MemoryPoint | null, to: MemoryPoint): number {
  if (!from) return -10;
  const dx = to.lng - from.lng;
  const dy = -(to.lat - from.lat);
  if (Math.abs(dx) + Math.abs(dy) < 0.000001) return -10;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
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
  const [speedAngle, setSpeedAngle] = useState(-10);

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

      const previous = i > 0 ? points[i - 1] : null;
      if (!previous) {
        await mapRef.current?.flyTo(points[i].lat, points[i].lng, 15.3, 900);
      } else {
        const angle = movementAngle(previous, points[i]);
        setSpeedAngle(angle);
        setSpeedTransition(true);
        await sleep(120);
        if (cancelledRef.current) return;
        // Камера реально летит к следующей точке, пока по экрану идут streaks.
        await mapRef.current?.dashTo(points[i].lat, points[i].lng, 15.3, 640);
        if (cancelledRef.current) return;
        await sleep(80);
        setSpeedTransition(false);
        await sleep(220);
      }
      if (cancelledRef.current) return;

      setVisibleCount(i + 1);
      haptic('light');
      await sleep(1200);
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
    <div
      className={`viewer${speedTransition ? ' viewer--speed-transition' : ''}`}
      style={
        {
          '--streak-angle': `${speedAngle}deg`,
          '--flight-x': `${Math.round(Math.cos((speedAngle * Math.PI) / 180) * 22)}px`,
          '--flight-y': `${Math.round(Math.sin((speedAngle * Math.PI) / 180) * 22)}px`,
        } as CSSProperties
      }
    >
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

      <div
        className="viewer__speed-lines"
        aria-hidden="true"
        style={{ '--streak-angle': `${speedAngle}deg` } as CSSProperties}
      >
        {SPEED_STREAKS.map((streak, index) => (
          <span
            key={index}
            className="viewer__speed-line"
            style={
              {
                '--streak-y': `${streak.y}%`,
                '--streak-x': `${streak.x}vw`,
                '--streak-len': `${streak.len}vw`,
                '--streak-h': `${streak.h}px`,
                '--streak-opacity': streak.opacity,
                '--streak-delay': `${streak.delay}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>

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
