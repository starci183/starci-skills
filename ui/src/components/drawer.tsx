import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { DURATION, EASE } from './motion';
import type { Concept } from './concept';

export const concept: Concept = 'frame';

/** Slides the drawer's header + body in from the right (fade + 32 px). The panel itself stays pinned. */
export function DrawerSlide({ children }: { children: ReactNode }) {
  return <motion.div className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: DURATION.enter, ease: EASE }}>{children}</motion.div>;
}

export function Drawer({ open, onOpenChange, title, description, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="drawer-panel">
      <DrawerSlide>
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>
        <div className="drawer-body">{children}</div>
      </DrawerSlide>
    </DialogContent>
  </Dialog>;
}
