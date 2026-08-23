import { useRef } from 'react';
import type { IntroSettings } from '../lib/intro';
import { Sheet } from '../components/Sheet';
import { IntroOverlay } from '../components/IntroOverlay';
import { blurOnEnter } from '../lib/keyboard';

interface IntroEditorSheetProps {
  open: boolean;
  title: string;
  authorName: string;
  intro: IntroSettings;
  pointCount: number;
  onAuthorNameChange: (value: string) => void;
  onIntroChange: (patch: Partial<IntroSettings>) => void;
  onClose: () => void;
}

export function IntroEditorSheet({
  open,
  title,
  authorName,
  intro,
  pointCount,
  onAuthorNameChange,
  onIntroChange,
  onClose,
}: IntroEditorSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (intro.photoPreview?.startsWith('blob:')) URL.revokeObjectURL(intro.photoPreview);
    onIntroChange({ photoFile: file, photoPreview: URL.createObjectURL(file) });
  }

  function removePhoto() {
    if (intro.photoPreview?.startsWith('blob:')) URL.revokeObjectURL(intro.photoPreview);
    onIntroChange({ photoFile: null, photoPreview: null });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Экран открытия">
      <div className="intro-editor__preview">
        <IntroOverlay
          compact
          title={title}
          authorName={authorName}
          eyebrow={intro.eyebrow}
          message={intro.message}
          buttonText={intro.buttonText}
          photoPreview={intro.photoPreview}
          pointCount={Math.max(pointCount, 1)}
        />
      </div>

      <div className="intro-editor__fields">
        <label className="editor__field">
          <span>Верхняя строка</span>
          <input
            value={intro.eyebrow}
            onChange={(e) => onIntroChange({ eyebrow: e.target.value })}
            onKeyDown={blurOnEnter}
            enterKeyHint="done"
            placeholder="Для тебя собрал"
            maxLength={60}
          />
        </label>

        <label className="editor__field">
          <span>От кого</span>
          <input
            value={authorName}
            onChange={(e) => onAuthorNameChange(e.target.value)}
            onKeyDown={blurOnEnter}
            enterKeyHint="done"
            placeholder="Ваше имя"
            maxLength={60}
          />
        </label>

        <div className="editor__field">
          <span>Фото-карточка</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className={`editor__photo ${intro.photoPreview ? 'editor__photo--filled' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {intro.photoPreview ? (
              <>
                <img src={intro.photoPreview} alt="" />
                <span className="editor__photo-change">Заменить фото</span>
              </>
            ) : (
              <span className="editor__photo-empty">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Добавить фотографию
              </span>
            )}
          </button>
          {intro.photoPreview && (
            <button type="button" className="intro-editor__remove-photo" onClick={removePhoto}>
              Убрать фото
            </button>
          )}
        </div>

        <label className="editor__field">
          <span>Подпись под названием</span>
          <textarea
            value={intro.message}
            onChange={(e) => onIntroChange({ message: e.target.value })}
            enterKeyHint="done"
            placeholder="Здесь остались наши самые тёплые моменты"
            rows={2}
            maxLength={200}
          />
        </label>

        <label className="editor__field">
          <span>Текст кнопки</span>
          <input
            value={intro.buttonText}
            onChange={(e) => onIntroChange({ buttonText: e.target.value })}
            onKeyDown={blurOnEnter}
            enterKeyHint="done"
            placeholder="Открыть карту"
            maxLength={40}
          />
        </label>
      </div>
    </Sheet>
  );
}
