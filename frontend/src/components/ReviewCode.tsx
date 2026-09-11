import { REVIEW_CODE } from '../lib/pricing';

export function ReviewCode({ className }: { className?: string }) {
  return (
    <p className={className ?? 'review-code'} aria-label="Кодовое слово для согласования">
      {REVIEW_CODE}
    </p>
  );
}
