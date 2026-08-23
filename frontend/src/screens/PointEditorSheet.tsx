import type { DraftPoint } from '../types';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { GalleryAsk } from '../components/GalleryAsk';
import { useGalleryPicker } from '../lib/gallery';
import { DateField } from '../components/DateField';
import { compressImage } from '../lib/compressImage';
import { blurOnEnter, hideSoftKeyboard } from '../lib/keyboard';

interface PointEditorSheetProps {
  point: DraftPoint | null;
  index: number;
  onChange: (patch: Partial<DraftPoint>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function PointEditorSheet({ point, index, onChange, onDelete, onClose }: PointEditorSheetProps) {
  const gallery = useGalleryPicker((file) => {
    if (!point) return;
    void (async () => {
      const compressed = await compressImage(file);
      if (point.photoPreview) URL.revokeObjectURL(point.photoPreview);
      onChange({ photoFile: compressed, photoPreview: URL.createObjectURL(compressed) });
    })();
  });

  return (
    <Sheet open={point !== null} onClose={onClose} title={`Место ${index + 1}`}>
      {point && (
        <div className="editor">
          <input
            ref={gallery.inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              gallery.handleChange(e.target.files);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            className={`editor__photo ${point.photoPreview ? 'editor__photo--filled' : ''}`}
            onClick={gallery.requestPick}
          >
            {point.photoPreview ? (
              <>
                <img src={point.photoPreview} alt="" />
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

          <label className="editor__field">
            <span>Заголовок</span>
            <input
              value={point.title}
              onChange={(e) => onChange({ title: e.target.value })}
              onKeyDown={blurOnEnter}
              enterKeyHint="done"
              placeholder="Например, «Наше первое свидание»"
              maxLength={80}
            />
          </label>

          <div className="editor__field">
            <span>Дата</span>
            <DateField
              value={point.happenedOn}
              onChange={(happenedOn) => onChange({ happenedOn })}
            />
            <span className="editor__field-hint">Необязательно — можно оставить пустой</span>
          </div>

          <label className="editor__field">
            <span>Описание</span>
            <textarea
              value={point.description}
              onChange={(e) => onChange({ description: e.target.value })}
              onKeyDown={blurOnEnter}
              enterKeyHint="done"
              placeholder="Расскажите, что здесь произошло…"
              rows={4}
              maxLength={1000}
            />
          </label>

          <div className="editor__actions">
            <Button variant="danger" onClick={onDelete}>
              Удалить
            </Button>
            <Button
              wide
              onClick={() => {
                hideSoftKeyboard();
                onClose();
              }}
            >
              Готово
            </Button>
          </div>
        </div>
      )}
      {gallery.asking && <GalleryAsk onAllow={gallery.allow} onDeny={gallery.deny} />}
    </Sheet>
  );
}
