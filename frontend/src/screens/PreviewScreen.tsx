import { useMemo } from 'react';
import type { DraftPoint, IntroSettings, MemoryPoint } from '../types';
import { ViewerExperience } from './ViewerExperience';

interface PreviewScreenProps {
  title: string;
  authorName: string;
  intro: IntroSettings;
  points: DraftPoint[];
  onBack: () => void;
}

/** Предпросмотр: тот же опыт, что у получателя, но на локальных данных. */
export function PreviewScreen({ title, authorName, intro, points, onBack }: PreviewScreenProps) {
  const memoryPoints = useMemo<MemoryPoint[]>(
    () =>
      points.map((p, i) => ({
        id: p.id,
        title: p.title.trim() || `Место ${i + 1}`,
        description: p.description.trim(),
        photoUrl: p.photoPreview,
        happenedOn: p.happenedOn ?? null,
        lat: p.lat,
        lng: p.lng,
      })),
    [points],
  );

  return (
    <ViewerExperience
      title={title.trim() || 'Карта воспоминаний'}
      authorName={authorName.trim() || null}
      intro={intro}
      points={memoryPoints}
      onExit={onBack}
      exitLabel="В редактор"
    />
  );
}
