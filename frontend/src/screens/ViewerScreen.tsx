import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { MemoryMapData } from '../types';
import { fetchMap } from '../api';
import { ViewerExperience } from './ViewerExperience';

interface ViewerScreenProps {
  mapId: string;
}

export function ViewerScreen({ mapId }: ViewerScreenProps) {
  const [data, setData] = useState<MemoryMapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMap(mapId)
      .then((map) => {
        if (!cancelled) setData(map);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  if (error) {
    return (
      <div className="status-screen">
        <h2>Карта не нашлась</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="status-screen">
        <motion.div
          className="publish-overlay__seal"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
        />
        <p>Открываем карту…</p>
      </div>
    );
  }

  return (
    <ViewerExperience
      title={data.title}
      authorName={data.authorName}
      intro={data.intro}
      points={data.points}
    />
  );
}
