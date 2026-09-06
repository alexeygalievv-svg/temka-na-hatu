import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DraftPoint, IntroSettings, PublishProgress } from './types';
import { DEFAULT_INTRO } from './types';
import { getStartParam, getUserName, haptic } from './telegram';
import { addPoint, createMap, uploadPhoto } from './api';
import { compressImage, fileFromPreview, fileToDataUrl } from './lib/compressImage';
import { clearDraft, loadDraft, restorePoints, saveDraftDebounced, saveDraftNow } from './lib/draftStorage';
import { BuilderScreen } from './screens/BuilderScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { ViewerScreen } from './screens/ViewerScreen';
import { LinkScreen } from './screens/LinkScreen';
import { isLegalPath, isPayPath } from './lib/legal';
import { LegalScreen } from './screens/LegalScreen';
import { PayScreen } from './screens/PayScreen';

type Route =
  | { name: 'builder' }
  | { name: 'preview' }
  | { name: 'pay' }
  | { name: 'link'; link: string }
  | { name: 'viewer'; mapId: string };

function Screen({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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

  const [route, setRoute] = useState<Route>(() => {
    if (viewMapId) return { name: 'viewer', mapId: viewMapId };
    if (isPayPath()) return { name: 'pay' };
    return { name: 'builder' };
  });
  const [mapTitle, setMapTitle] = useState('Наши места');
  const [authorName, setAuthorName] = useState(() => getUserName() ?? '');
  const [intro, setIntro] = useState<IntroSettings>(DEFAULT_INTRO);
  const [points, setPoints] = useState<DraftPoint[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [publishing, setPublishing] = useState<PublishProgress | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const draftRef = useRef({ mapTitle, authorName, intro, points });
  draftRef.current = { mapTitle, authorName, intro, points };

  function patchIntro(patch: Partial<IntroSettings>) {
    setIntro((prev) => {
      if (
        patch.photoPreview !== undefined &&
        prev.photoPreview?.startsWith('blob:') &&
        prev.photoPreview !== patch.photoPreview
      ) {
        URL.revokeObjectURL(prev.photoPreview);
      }
      return { ...prev, ...patch };
    });
  }

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

  async function publish(): Promise<{ id: string; link: string }> {
    const draft = draftRef.current;
    if (draft.points.length === 0) throw new Error('Добавьте хотя бы одно место');
    if (publishing) throw new Error('Публикация уже идёт');
    setPublishError(null);
    try {
      setPublishing({ step: 'map' });
      const storedIntro = loadDraft()?.intro;
      const introPreview = storedIntro?.photoPreview ?? draft.intro.photoPreview;
      let introPhotoDataUrl =
        introPreview?.startsWith('data:image/') ? introPreview : undefined;
      if (!introPhotoDataUrl) {
        const introFile = await fileFromPreview(
          storedIntro?.photoFile ?? draft.intro.photoFile,
          introPreview,
          'intro.jpg',
        );
        if (introFile) {
          introPhotoDataUrl = await fileToDataUrl(await compressImage(introFile));
        }
      }

      const mapPayload = {
        title: draft.mapTitle.trim() || 'Карта воспоминаний',
        authorName: draft.authorName.trim() || getUserName(),
        introEyebrow: draft.intro.eyebrow,
        introMessage: draft.intro.message,
        introButton: draft.intro.buttonText,
        introPhotoDataUrl,
      };
      let created: { id: string; link: string; introPhotoUrl?: string | null };
      try {
        created = await createMap(mapPayload);
      } catch {
        created = await createMap({ ...mapPayload, introPhotoDataUrl: undefined });
      }
      const { id, link } = created;
      const createdIntroUrl = created.introPhotoUrl ?? null;
      const publishedPoints = [...draft.points];
      for (let i = 0; i < publishedPoints.length; i++) {
        const point = publishedPoints[i];
        let photoUrl: string | null = null;
        const pointFile = await fileFromPreview(point.photoFile, point.photoPreview, `photo-${i}.jpg`);
        if (pointFile) {
          setPublishing({ step: 'photo', index: i, total: publishedPoints.length });
          photoUrl = (await uploadPhoto(id, await compressImage(pointFile))).url;
        } else if (point.photoPreview?.startsWith('http')) {
          photoUrl = point.photoPreview;
        }
        setPublishing({ step: 'point', index: i, total: publishedPoints.length });
        await addPoint(id, {
          title: point.title.trim() || `Место ${i + 1}`,
          description: point.description.trim(),
          photoUrl,
          happenedOn: point.happenedOn,
          lat: point.lat,
          lng: point.lng,
          orderIndex: i,
        });
        if (photoUrl && photoUrl !== point.photoPreview) {
          if (point.photoPreview?.startsWith('blob:')) URL.revokeObjectURL(point.photoPreview);
          publishedPoints[i] = { ...point, photoFile: null, photoPreview: photoUrl };
        }
      }
      if (createdIntroUrl && draft.intro.photoPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(draft.intro.photoPreview);
      }
      const nextIntro = createdIntroUrl
        ? { ...draft.intro, photoFile: null, photoPreview: createdIntroUrl }
        : draft.intro;
      setIntro(nextIntro);
      setPoints(publishedPoints);
      draftRef.current = {
        mapTitle: draft.mapTitle,
        authorName: draft.authorName,
        intro: nextIntro,
        points: publishedPoints,
      };
      await saveDraftNow({
        mapTitle: draft.mapTitle,
        authorName: draft.authorName,
        intro: nextIntro,
        points: publishedPoints,
      });
      haptic('medium');
      return { id, link };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Что-то пошло не так';
      if (message.includes('401') || message.toLowerCase().includes('init data')) {
        setPublishError('Откройте приложение через Telegram-бота и попробуйте снова');
      } else {
        setPublishError(message);
      }
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setPublishing(null);
    }
  }

  function resetAll() {
    points.forEach((point) => {
      if (point.photoPreview?.startsWith('blob:')) URL.revokeObjectURL(point.photoPreview);
    });
    if (intro.photoPreview?.startsWith('blob:')) URL.revokeObjectURL(intro.photoPreview);
    clearDraft();
    setMapTitle('Наши места');
    setAuthorName(getUserName() ?? '');
    setIntro(DEFAULT_INTRO);
    setPoints([]);
    setPublishError(null);
    setPublishing(null);
    setRoute({ name: 'builder' });
    haptic('soft');
  }

  if (isLegalPath()) {
    return (
      <div className="app">
        <LegalScreen />
      </div>
    );
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
              onIntroChange={patchIntro}
              points={points}
              onPointsChange={setPoints}
              onPreview={() => setRoute({ name: 'preview' })}
              onPublish={() => {
                setPublishError(null);
                setRoute({ name: 'pay' });
              }}
              onReset={resetAll}
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
        {route.name === 'pay' && (
          <Screen key="pay">
            <PayScreen
              mapTitle={mapTitle}
              prepareMap={
                isPayPath()
                  ? undefined
                  : async () => {
                      const created = await publish();
                      return { mapId: created.id, link: created.link };
                    }
              }
              onPaid={(link) => {
                if (link) setRoute({ name: 'link', link });
              }}
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
              onReset={resetAll}
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
