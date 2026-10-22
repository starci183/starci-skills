import type { ReactNode } from 'react';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import type { Concept } from './concept';
import { t } from '../i18n/t';

/** The business concept id (frame) under which the shared side drawer is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'frame';

/** The right-hand sheet that shows read-only technical details, restoring focus to the page when its opener is gone. */
export const Drawer = ({ open, onOpenChange, title, description, children }: Readonly<{
  open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode;
}>) => {
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="drawer-panel"
      onCloseAutoFocus={event => {
        // Native FocusScope restores the origin; a removed origin falls back to the page.
        const active = document.activeElement;
        if (active && active !== document.body && active !== document.documentElement) return;
        const main = document.getElementById('main-content');
        if (main) { event.preventDefault(); main.focus(); }
      }}>
      <SheetHeader className="drawer-header"><SheetTitle className="min-w-0 break-words">{title}</SheetTitle><SheetDescription>{description ?? t('Read-only technical details')}</SheetDescription></SheetHeader>
      <SheetBody className="drawer-body">{children}</SheetBody>
    </SheetContent>
  </Sheet>;
};
