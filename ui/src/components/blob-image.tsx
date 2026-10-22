import { useState } from 'react';
import type { BlobLink } from '../contract';
import type { Concept } from './concept';
import { FeedbackState } from './feedback-state';
import { t } from '../i18n/t';
import { MediaImage } from './ui/media-image';

/** The business concept id (C11) under which the stored-image view is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C11';

type BlobImageProps = { readonly blob: BlobLink | null; readonly alt: string; readonly className?: string };

/** Why there is no picture to draw: archived away, failed to load, or not recorded yet. */
const missingImageText = (blob: BlobLink | null, failed: boolean, alt: string): string => {
  if (blob?.archived) return t('The image is archived and cannot be read right now.');
  if (failed) return t('Could not load image {name}.', { name: alt });
  return t('No image to show yet.');
};

/** A stored image fetched from the blob store, replaced by a feedback state when it is archived, missing or fails to load. */
export const BlobImage = ({ blob, alt, className = '' }: BlobImageProps) => {
  const [failedHref, setFailedHref] = useState<string | null>(null);
  const failed = failedHref !== null && failedHref === blob?.href;
  if (!blob || failed) return <div className={className}><FeedbackState error={failed}>{missingImageText(blob, failed, alt)}</FeedbackState></div>;
  return <MediaImage className={className} src={blob.href} alt={alt} loading="lazy" onStatusChange={status => { if (status === 'error') setFailedHref(blob.href); }} />;
};
