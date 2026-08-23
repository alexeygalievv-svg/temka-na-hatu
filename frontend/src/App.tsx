import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DraftPoint, IntroSettings, PublishProgress } from './types';
import { DEFAULT_INTRO } from './types';
import { getStartParam, getUserName, haptic } from './telegram';
import { addPoint, createMap, updateMap, uploadPhoto } from './api';
import { clearDraft, loadDraft, restorePoints, saveDraftDebounced } from './lib/draftStorage';
import { BuilderScreen } from './screens/BuilderScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { ViewerScreen } from './screens/ViewerScreen';
import { LinkScreen } from './screens/LinkScreen';

type Route =
  | { name: 'builder' }
  | { name: 'preview' }
  | { name: 'link'; link: string }
  | { name: 'viewer'; mapId: string };

const screenVariants = {
  initial: { opacity: 0, scale: 0.985, y: 14 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 1.01, y: -10 },
};

function Screen({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="screen"
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const viewMapId = useMemo(() => {
    const param = getStartParam();
    return param?.startsWith('map_') ? param.slice(4) : null;
  }, []);

  const [route, setRoute] = useState<Route>(
    viewMapId ? { name: 'viewer', mapId: viewMapId } : { name: 'builder' },
  );
  const [mapTitle, setMapTitle] = useState('Наши места');
  const [authorName, setAuthorName] = useState(() => getUserName() ?? '');
  const [intro, setIntro] = useState<IntroSettings>(DEFAULT_INTRO);
  const [points, setPoints] = useState<DraftPoint[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [publishing, setPublishing] = useState<PublishProgress | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (viewMapId) return;
    const saved = loadDraft();
    if (saved) {
      setMapTitle(saved.mapTitle);
      setAuthorName(saved.authorName);
      setIntro(saved.intro ?? DEFAULT_INTRO);
      setPoints(restorePoints(saved.points));
    }
    setDraftReady(true);
  }, [viewMapId]);

  useEffect(() => {
    if (!draftReady || viewMapId) return;
    saveDraftDebounced({ mapTitle, authorName, intro, points });
  }, [draftReady, viewMapId, mapTitle, authorName, intro, points]);

  async function publish() {
    if (points.length === 0 || publishing) return;
    setPublishError(null);
    try {
      setPublishing({ step: 'map' });
      const { id, link } = await createMap({
        title: mapTitle.trim() || 'Карта воспоминаний',
        authorName: authorName.trim() || getUserName(),
        introEyebrow: intro.eyebrow,
        introMessage: intro.message,
        introButton: intro.buttonText,
      });
      if (intro.photoFile) {
        setPublishing({ step: 'photo', index: 0, total: points.length });
        const { url } = await uploadPhoto(id, intro.photoFile);
        await updateMap(id, { introPhotoUrl: url });
      }
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        let photoUrl: string | null = null;
        if (point.photoFile) {
          setPublishing({ step: 'photo', index: i, total: points.length });
          photoUrl = (await uploadPhoto(id, point.photoFile)).url;
        }
        setPublishing({ step: 'point', index: i, total: points.length });
        await addPoint(id, {
          title: point.title.trim() || `Место ${i + 1}`,
          description: point.description.trim(),
          photoUrl,
          lat: point.lat,
          lng: point.lng,
          orderIndex: i,
        });
      }
      haptic('medium');
      clearDraft();
      setRoute({ name: 'link', link });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Что-то пошло не так';
      if (message.includes('401') || message.toLowerCase().includes('init data')) {
        setPublishError('Откройте приложение через Telegram-бота и попробуйте снова');
      } else {
        setPublishError(message);
      }
    } finally {
      setPublishing(null);
    }
  }

  return (
    <div className="app">
      <AnimatePresence mode="wait">
        {route.name === 'builder' && (
          <Screen key="builder">
            <BuilderScreen
              title={mapTitle}
              onTitleChange={setMapTitle}
              authorName={authorName}
              onAuthorNameChange={setAuthorName}
              intro={intro}
              onIntroChange={setIntro}
              points={points}
              onPointsChange={setPoints}
              onPreview={() => setRoute({ name: 'preview' })}
              onPublish={publish}
              publishing={publishing}
              publishError={publishError}
              onDismissError={() => setPublishError(null)}
            />
          </Screen>
        )}
        {route.name === 'preview' && (
          <Screen key="preview">
            <PreviewScreen
              title={mapTitle}
              authorName={authorName}
              intro={intro}
              points={points}
              onBack={() => setRoute({ name: 'builder' })}
            />
          </Screen>
        )}
        {route.name === 'link' && (
          <Screen key="link">
            <LinkScreen
              link={route.link}
              title={mapTitle}
              onBack={() => setRoute({ name: 'builder' })}
            />
          </Screen>
        )}
        {route.name === 'viewer' && (
          <Screen key="viewer">
            <ViewerScreen mapId={route.mapId} />
          </Screen>
        )}
      </AnimatePresence>
    </div>
  );
}
