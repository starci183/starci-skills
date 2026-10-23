import type { ComponentProps, ReactNode } from 'react';
import { Avatar } from '@heroui/react';
import { cn } from '@/lib/utils';

type MediaImageProps = Pick<ComponentProps<typeof Avatar.Image>, 'onLoad' | 'loading' | 'crossOrigin' | 'draggable' | 'title'> & {
  readonly src: string;
  /** Required: the accessible name of the picture, or "" for a purely decorative one. */
  readonly alt: string;
  /** Classes of the picture itself (size, fit, border). */
  readonly className?: string;
  /** Classes of the frame around the picture (display, size when the picture is positioned by the frame). */
  readonly frameClassName?: string;
  /** Rendered instead of the picture while it has not loaded or when it cannot be loaded. */
  readonly fallback?: ReactNode;
  /** Reports the load status of the picture: `loaded` when it can be shown, `error` when it cannot be read. */
  readonly onStatusChange?: (status: 'idle' | 'loading' | 'loaded' | 'error') => void;
};

/**
 * A picture the browser fetched from a URL, drawn by the design system's image primitive (the HeroUI avatar image, which owns the
 * load and error states) and reset to flow like a plain image: it keeps its intrinsic size, the caller's classes decide the fit.
 */
export const MediaImage = ({ src, alt, className, frameClassName, fallback, onStatusChange, ...props }: MediaImageProps) => {
  return <Avatar className={cn('inline-flex size-auto items-start justify-start overflow-visible rounded-none bg-transparent', frameClassName)}>
    <Avatar.Image
      {...props}
      src={src}
      alt={alt}
      className={cn('static inset-auto aspect-auto size-auto', className)}
      {...(onStatusChange === undefined ? {} : { onLoadingStatusChange: onStatusChange })}
    />
    {fallback === undefined ? null : <Avatar.Fallback className="size-auto bg-transparent">{fallback}</Avatar.Fallback>}
  </Avatar>;
};
