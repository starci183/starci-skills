import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { BlobLink } from '../contract';
import type { Concept } from './concept';
import { t } from '../i18n/t';

export const concept: Concept = 'C11';

export function BlobImage({ blob, alt, className = '' }: { readonly blob: BlobLink | null; readonly alt: string; readonly className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!blob || failed) return <output className={`blob-unavailable ${className}`}><ImageOff className="size-4" aria-hidden="true" />{blob?.archived ? t('The image is archived and cannot be read right now.') : t('No image to show yet.')}</output>;
  return <img className={className} src={blob.href} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}
