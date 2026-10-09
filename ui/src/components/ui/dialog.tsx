import * as React from "react"
import { Description, Modal } from "@heroui/react"
import { cn } from "@/lib/utils"
import { t } from "../../i18n/t"

const DescriptionContext = React.createContext<string | undefined>(undefined)

type DialogProps = Omit<React.ComponentProps<typeof Modal.Root>, "isOpen"> & {
  open?: boolean
}

function Dialog({ open, ...props }: DialogProps) {
  const descriptionId = React.useId()
  return <DescriptionContext value={descriptionId}>
    <Modal.Root isOpen={open} {...props} />
  </DescriptionContext>
}

function DialogTrigger({ asChild = false, children, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  // HeroUI Button and Link consume the root's press context directly.
  if (asChild) return <>{children}</>
  return <Modal.Trigger<"button"> data-ui="dialog-trigger" {...props}
    render={triggerProps => <button {...triggerProps} type={props.type ?? "button"} />}>
    {children}
  </Modal.Trigger>
}

function DialogClose(props: React.ComponentProps<typeof Modal.CloseTrigger>) {
  return <Modal.CloseTrigger data-ui="dialog-close" aria-label={t('Close')} {...props} />
}

function DialogOverlay(props: React.ComponentProps<typeof Modal.Backdrop>) {
  return <Modal.Backdrop data-ui="dialog-overlay" {...props} />
}

// The vendor backdrop owns portal placement; this retained wrapper adds no second portal.
function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

type CloseAutoFocusProps = {
  onCloseAutoFocus?: (event: Event) => void
}

/** Runs caller-specific return-focus work after the vendor's exit and FocusScope restoration. */
function OverlayFocusLifecycle({ children, generation, onCloseAutoFocus }: CloseAutoFocusProps & {
  children: React.ReactNode
  generation: React.RefObject<number>
}) {
  const callback = React.useRef(onCloseAutoFocus)
  const frame = React.useRef<number | undefined>(undefined)
  React.useLayoutEffect(() => { callback.current = onCloseAutoFocus }, [onCloseAutoFocus])
  React.useLayoutEffect(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    const current = ++generation.current
    return () => {
      frame.current = requestAnimationFrame(() => {
        frame.current = requestAnimationFrame(() => {
          if (generation.current === current) callback.current?.(new Event('closeAutoFocus', { cancelable: true }))
        })
      })
    }
  }, [generation])
  return <>{children}</>
}

function DialogContent({ className, children, showCloseButton = true, onCloseAutoFocus, backdropProps, containerProps, ...props }:
  React.ComponentProps<typeof Modal.Dialog> & CloseAutoFocusProps & {
    showCloseButton?: boolean
    backdropProps?: Omit<React.ComponentProps<typeof Modal.Backdrop>, "children">
    containerProps?: Omit<React.ComponentProps<typeof Modal.Container>, "children">
  }) {
  const descriptionId = React.useContext(DescriptionContext)
  const generation = React.useRef(0)
  const describedBy = Object.hasOwn(props, 'aria-describedby') ? props['aria-describedby'] : descriptionId
  return <DialogOverlay {...backdropProps}>
    <Modal.Container placement="center" scroll="inside" size="lg" className="starci-dialog-container" {...containerProps}>
      <OverlayFocusLifecycle generation={generation} onCloseAutoFocus={onCloseAutoFocus}>
        <Modal.Dialog data-ui="dialog-content" aria-describedby={describedBy}
          className={cn("gap-6 text-sm", className)} {...props}>
          {dialog => <>
            {typeof children === 'function' ? children(dialog) : children}
            {showCloseButton && <DialogClose />}
          </>}
        </Modal.Dialog>
      </OverlayFocusLifecycle>
    </Modal.Container>
  </DialogOverlay>
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <Modal.Header data-ui="dialog-header" className={cn("gap-2", className)} {...props} />
}

function DialogBody(props: React.ComponentProps<typeof Modal.Body>) {
  return <Modal.Body data-ui="dialog-body" {...props} />
}

function DialogFooter({ className, showCloseButton = false, children, ...props }:
  React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  return <Modal.Footer data-ui="dialog-footer" className={cn("gap-2", className)} {...props}>
    {children}
    {showCloseButton && <DialogClose className="static">{t('Close')}</DialogClose>}
  </Modal.Footer>
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof Modal.Heading>) {
  return <Modal.Heading data-ui="dialog-title" className={cn("font-sans font-medium", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  const descriptionId = React.useContext(DescriptionContext)
  return <Description elementType="p" id={descriptionId} data-ui="dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogOverlay, DialogPortal, DialogTitle, DialogTrigger, OverlayFocusLifecycle,
}
