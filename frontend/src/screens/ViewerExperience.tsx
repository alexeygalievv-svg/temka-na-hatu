import { useEffect, useRef, useState } from 'react';
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
  const [cameraMoving, setCameraMoving] = useState(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  async function startReveal() {
    setStage('reveal');
    haptic('medium');

    if (points[0]) {
      await mapRef.current?.preload(points[0].lat, points[0].lng, 15.3, 500);
    }

    for (let i = 0; i < points.length; i++) {
      if (cancelledRef.current) return;
      setCurrentIndex(i);

      // Небольшая пауза стабилизирует предыдущий кадр, затем тёплая
      // подложка маскирует догрузку тайлов во время плавного panTo.
      await sleep(160);
      setCameraMoving(true);
      await sleep(220);
      await mapRef.current?.flyTo(points[i].lat, points[i].lng, 15.3, 1200);
      await sleep(140);
      if (cancelledRef.current) return;
      setCameraMoving(false);
      await sleep(320);
      if (cancelledRef.current) return;

      setVisibleCount(i + 1);
      haptic('light');

      // Пока получатель рассматривает текущую точку, невидимая карта
      // заранее запрашивает тайлы следующего региона в HTTP-кеш.
      const nextPoint = points[i + 1];
      await Promise.all([
        sleep(1100),
        nextPoint
          ? mapRef.current?.preload(nextPoint.lat, nextPoint.lng, 15.3, 650)
          : Promise.resolve(),
      ]);
    }
    if (cancelledRef.current) return;
    setCurrentIndex(-1);
    if (points.length > 1) {
      await sleep(160);
      setCameraMoving(true);
      await sleep(220);
      await mapRef.current?.fitAll(points, 1400);
      await sleep(140);
      setCameraMoving(false);
      await sleep(320);
    }
    if (cancelledRef.current) return;
    setStage('explore');
  }

  const shownPoints = stage === 'explore' ? points : points.slice(0, visibleCount);
  const activePoint = points.find((p) => p.id === activeId) ?? null;
  const activeIndex = activePoint ? points.indexOf(activePoint) : -1;

  return (
    <div className="viewer">
      <MapCanvas
        ref={mapRef}
        initialCenter={points[0] ?? { lat: 55.7512, lng: 37.6184 }}
        initialZoom={10}
        pins={shownPoints.map((p, i) => ({
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          label: String(i + 1),
          active: p.id === activeId,
        }))}
        onPinClick={(id) => {
          if (stage !== 'explore') return;
          haptic('light');
          setActiveId(id);
        }}
      />

      <motion.div
        className="viewer__camera-fade"
        aria-hidden="true"
        initial={false}
        animate={{ opacity: cameraMoving ? 0.26 : 0 }}
        transition={{ duration: cameraMoving ? 0.22 : 0.34, ease: 'easeInOut' }}
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
