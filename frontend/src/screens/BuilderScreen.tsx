import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DraftPoint, IntroSettings, PublishProgress } from '../types';
import { haptic } from '../telegram';
import { MapCanvas, type MapHandle } from '../components/MapCanvas';
import { Button } from '../components/Button';
import { BuilderOnboarding } from '../components/BuilderOnboarding';
import { PointEditorSheet } from './PointEditorSheet';
import { PointListSheet } from './PointListSheet';
import { IntroEditorSheet } from './IntroEditorSheet';

const MOSCOW = { lat: 55.7512, lng: 37.6184 };
const ONBOARDING_KEY = 'builder-onboarding-seen';

interface BuilderScreenProps {
  title: string;
  onTitleChange: (title: string) => void;
  authorName: string;
  onAuthorNameChange: (value: string) => void;
  intro: IntroSettings;
  onIntroChange: (intro: IntroSettings) => void;
  points: DraftPoint[];
  onPointsChange: (points: DraftPoint[]) => void;
  onPreview: () => void;
  onPublish: () => void;
  publishing: PublishProgress | null;
  publishError: string | null;
  onDismissError: () => void;
}

function publishLabel(progress: PublishProgress): string {
  switch (progress.step) {
    case 'map':
      return 'Создаём карту…';
    case 'photo':
      return `Загружаем фото ${progress.index + 1} из ${progress.total}…`;
    case 'point':
      return `Сохраняем место ${progress.index + 1} из ${progress.total}…`;
  }
}

export function BuilderScreen({
  title,
  onTitleChange,
  authorName,
  onAuthorNameChange,
  intro,
  onIntroChange,
  points,
  onPointsChange,
  onPreview,
  onPublish,
  publishing,
  publishError,
  onDismissError,
}: BuilderScreenProps) {
  const mapRef = useRef<MapHandle>(null);
  const mapFittedRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(
    () => sessionStorage.getItem(ONBOARDING_KEY) !== '1',
  );

  const selected = points.find((p) => p.id === selectedId) ?? null;
  const selectedIndex = selected ? points.indexOf(selected) : -1;

  useEffect(() => {
    if (points.length === 0 || mapFittedRef.current) return;
    mapFittedRef.current = true;
    const timer = window.setTimeout(() => {
      mapRef.current?.fitAll(
        points.map((p) => ({ lat: p.lat, lng: p.lng })),
        0,
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [points]);

  function handleMapClick(coords: { lat: number; lng: number }) {
    const point: DraftPoint = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      photoFile: null,
      photoPreview: null,
      lat: coords.lat,
      lng: coords.lng,
    };
    onPointsChange([...points, point]);
    setSelectedId(point.id);
    haptic('medium');
  }

  function patchPoint(id: string, patch: Partial<DraftPoint>) {
    onPointsChange(points.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function deletePoint(id: string) {
    const point = points.find((p) => p.id === id);
    if (point?.photoPreview?.startsWith('blob:')) URL.revokeObjectURL(point.photoPreview);
    onPointsChange(points.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
    haptic('soft');
  }

  function dismissOnboarding() {
    sessionStorage.setItem(ONBOARDING_KEY, '1');
    setOnboardingOpen(false);
    haptic('soft');
  }

  function focusPoint(id: string) {
    const point = points.find((p) => p.id === id);
    if (point) mapRef.current?.flyTo(point.lat, point.lng, 15, 900);
    setListOpen(false);
    setSelectedId(id);
  }

  return (
    <div className="builder">
      <MapCanvas
        ref={mapRef}
        initialCenter={points[0] ?? MOSCOW}
        initialZoom={12}
        pins={points.map((p, i) => ({
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          label: String(i + 1),
          active: p.id === selectedId,
        }))}
        onMapClick={handleMapClick}
        onPinClick={(id) => setSelectedId(id)}
      />

      <header className="builder__header">
        <span className="builder__eyebrow">Карта воспоминаний</span>
        <input
          className="builder__title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Название карты"
          maxLength={60}
        />
      </header>

      <footer className="builder__dock">
        <Button variant="ghost" onClick={() => setIntroOpen(true)}>
          Открытие
        </Button>
        <Button variant="ghost" onClick={() => setListOpen(true)} disabled={points.length === 0}>
          Точки
          {points.length > 0 && <span className="btn__badge">{points.length}</span>}
        </Button>
        <Button variant="ghost" onClick={onPreview} disabled={points.length === 0}>
          Предпросмотр
        </Button>
        <Button onClick={onPublish} disabled={points.length === 0 || publishing !== null}>
          Ссылка
        </Button>
      </footer>

      <IntroEditorSheet
        open={introOpen}
        title={title}
        authorName={authorName}
        intro={intro}
        pointCount={points.length}
        onAuthorNameChange={onAuthorNameChange}
        onIntroChange={(patch) => onIntroChange({ ...intro, ...patch })}
        onClose={() => setIntroOpen(false)}
      />

      <PointEditorSheet
        point={selected}
        index={selectedIndex}
        onChange={(patch) => selected && patchPoint(selected.id, patch)}
        onDelete={() => selected && deletePoint(selected.id)}
        onClose={() => setSelectedId(null)}
      />

      <PointListSheet
        open={listOpen}
        points={points}
        onReorder={onPointsChange}
        onSelect={focusPoint}
        onDelete={deletePoint}
        onClose={() => setListOpen(false)}
      />

      <AnimatePresence>
        {onboardingOpen && <BuilderOnboarding onStart={dismissOnboarding} />}
      </AnimatePresence>

      <AnimatePresence>
        {publishing && (
          <motion.div
            className="publish-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="publish-overlay__seal"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
            />
            <motion.p
              key={publishLabel(publishing)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {publishLabel(publishing)}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {publishError && (
          <motion.button
            className="toast toast--error"
            onClick={onDismissError}
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {publishError}
            <span className="toast__hint">нажмите, чтобы скрыть</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
