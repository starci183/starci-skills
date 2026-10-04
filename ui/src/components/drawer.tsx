import { useRef, type ReactNode } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import type { Concept } from './concept';
import { t } from '../i18n/t';

export const concept: Concept = 'frame';

export function Drawer({ open, onOpenChange, title, description, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode;
}) {
  const returnFocus = useRef<HTMLElement | SVGElement | null>(null);
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="drawer-panel"
      onOpenAutoFocus={event => {
        const target = document.activeElement;
        if (event.currentTarget instanceof HTMLElement && event.currentTarget.contains(target)) return;
        returnFocus.current = (target instanceof HTMLElement || target instanceof SVGElement)
          && typeof target.focus === 'function' && target !== document.body && target !== document.documentElement ? target : null;
      }}
      onCloseAutoFocus={event => {
        const target = returnFocus.current?.isConnected ? returnFocus.current : document.getElementById('main-content');
        if (target) { event.preventDefault(); target.focus(); }
      }}>
      <SheetHeader className="drawer-header"><SheetTitle>{title}</SheetTitle><SheetDescription>{description ?? t('Read-only technical details')}</SheetDescription></SheetHeader>
      <div className="drawer-body">{children}</div>
    </SheetContent>
  </Sheet>;
}
