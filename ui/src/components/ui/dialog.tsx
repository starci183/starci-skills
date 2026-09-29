import * as React from 'react';
import { Modal } from '@heroui/react';
import { XIcon } from 'lucide-react';

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  return <Modal isOpen={open} onOpenChange={onOpenChange}>{children}</Modal>;
}

export function DialogContent({ className, children, showCloseButton = true, ...props }: Omit<React.ComponentProps<typeof Modal.Dialog>, 'children'> & { children: React.ReactNode; showCloseButton?: boolean }) {
  return <Modal.Backdrop className="st-dialog-backdrop">
    <Modal.Container placement="center" className="st-dialog-container">
      <Modal.Dialog data-slot="dialog-content" className={['st-dialog', className].filter(Boolean).join(' ')} {...props}>
        {children}
        {showCloseButton && <Modal.CloseTrigger data-slot="dialog-close" className="st-dialog-close" aria-label="Đóng"><XIcon size={16} aria-hidden="true" /></Modal.CloseTrigger>}
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>;
}

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <Modal.Header data-slot="dialog-header" className={['st-dialog-header', className].filter(Boolean).join(' ')} {...props} />;
}
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof Modal.Heading>) {
  return <Modal.Heading data-slot="dialog-title" className={['st-dialog-title', className].filter(Boolean).join(' ')} {...props} />;
}
export function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="dialog-description" className={['st-dialog-description', className].filter(Boolean).join(' ')} {...props} />;
}
