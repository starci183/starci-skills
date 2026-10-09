import * as React from "react"
import { Description, Drawer } from "@heroui/react"
import { cn } from "@/lib/utils"
import { t } from "../../i18n/t"
import { OverlayFocusLifecycle } from "./dialog"

const DescriptionContext = React.createContext<string | undefined>(undefined)

type SheetProps = Omit<React.ComponentProps<typeof Drawer.Root>, "isOpen"> & { open?: boolean }

function Sheet({ open, ...props }: SheetProps) {
  const descriptionId = React.useId()
  return <DescriptionContext value={descriptionId}>
    <Drawer.Root isOpen={open} {...props} />
  </DescriptionContext>
}

function SheetTrigger({ asChild = false, children, ...props }:
  React.ComponentProps<typeof Drawer.Trigger> & { asChild?: boolean }) {
  if (asChild) return <>{children}</>
  return <Drawer.Trigger data-ui="sheet-trigger" {...props}>{children}</Drawer.Trigger>
}

function SheetClose(props: React.ComponentProps<typeof Drawer.CloseTrigger>) {
  return <Drawer.CloseTrigger data-ui="sheet-close" aria-label={t('Close')} {...props} />
}

function SheetPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function SheetOverlay(props: React.ComponentProps<typeof Drawer.Backdrop>) {
  return <Drawer.Backdrop data-ui="sheet-overlay" {...props} />
}

function SheetContent({ className, children, side = "right", showCloseButton = true, onCloseAutoFocus, backdropProps, containerProps, ...props }:
  React.ComponentProps<typeof Drawer.Dialog> & {
    side?: "top" | "right" | "bottom" | "left"
    showCloseButton?: boolean
    onCloseAutoFocus?: (event: Event) => void
    backdropProps?: Omit<React.ComponentProps<typeof Drawer.Backdrop>, "children">
    containerProps?: Omit<React.ComponentProps<typeof Drawer.Content>, "children" | "placement">
  }) {
  const descriptionId = React.useContext(DescriptionContext)
  const generation = React.useRef(0)
  const describedBy = Object.hasOwn(props, 'aria-describedby') ? props['aria-describedby'] : descriptionId
  return <SheetOverlay {...backdropProps}>
    <Drawer.Content placement={side} className="starci-sheet-container" {...containerProps}>
      <OverlayFocusLifecycle generation={generation} onCloseAutoFocus={onCloseAutoFocus}>
        <Drawer.Dialog data-ui="sheet-content" data-side={side} aria-describedby={describedBy}
          className={cn("gap-4 text-sm", className)} {...props}>
          {dialog => <>
            {typeof children === 'function' ? children(dialog) : children}
            {showCloseButton && <SheetClose />}
          </>}
        </Drawer.Dialog>
      </OverlayFocusLifecycle>
    </Drawer.Content>
  </SheetOverlay>
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <Drawer.Header data-ui="sheet-header" className={cn("gap-1.5", className)} {...props} />
}

function SheetBody(props: React.ComponentProps<typeof Drawer.Body>) {
  return <Drawer.Body data-ui="sheet-body" {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <Drawer.Footer data-ui="sheet-footer" className={cn("gap-2", className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof Drawer.Heading>) {
  return <Drawer.Heading data-ui="sheet-title" className={cn("font-sans font-medium", className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<"p">) {
  const descriptionId = React.useContext(DescriptionContext)
  return <Description elementType="p" id={descriptionId} data-ui="sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  Sheet, SheetTrigger, SheetClose, SheetPortal, SheetOverlay, SheetContent, SheetHeader,
  SheetBody, SheetFooter, SheetTitle, SheetDescription,
}
