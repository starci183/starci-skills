import { useState } from 'react';
import type { BlobLink } from '../contract';
import type { Concept } from './concept';
import { FeedbackState } from './feedback-state';
import { t } from '../i18n/t';

export const concept: Concept = 'C11';

export function BlobImage({ blob, alt, className = '' }: { readonly blob: BlobLink | null; readonly alt: string; readonly className?: string }) {
  const [failedHref, setFailedHref] = useState<string | null>(null);
  const failed = blob != null && failedHref === blob.href;
  if (!blob || failed) return <div className={className}><FeedbackState error={failed}>
    {blob?.archived ? t('The image is archived and cannot be read right now.') : failed ? t('Could not load image {name}.', { name: alt }) : t('No image to show yet.')}
  </FeedbackState></div>;
  return <img className={className} src={blob.href} alt={alt} loading="lazy" onError={() => setFailedHref(blob.href)} />;
}
