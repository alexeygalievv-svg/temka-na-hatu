import type { IntroSettings } from '../lib/intro';
import { Sheet } from '../components/Sheet';
import { IntroOverlay } from '../components/IntroOverlay';

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
          pointCount={Math.max(pointCount, 1)}
        />
      </div>

      <div className="intro-editor__fields">
        <label className="editor__field">
          <span>Верхняя строка</span>
          <input
            value={intro.eyebrow}
            onChange={(e) => onIntroChange({ eyebrow: e.target.value })}
            placeholder="Для тебя собрал"
            maxLength={60}
          />
        </label>

        <label className="editor__field">
          <span>От кого</span>
          <input
            value={authorName}
            onChange={(e) => onAuthorNameChange(e.target.value)}
            placeholder="Ваше имя"
            maxLength={60}
          />
        </label>

        <label className="editor__field">
          <span>Подпись под названием</span>
          <textarea
            value={intro.message}
            onChange={(e) => onIntroChange({ message: e.target.value })}
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
            placeholder="Открыть карту"
            maxLength={40}
          />
        </label>
      </div>
    </Sheet>
  );
}
