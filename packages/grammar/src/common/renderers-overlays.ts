// Overlay and feedback renderers added to the Common contract (conflict-free component-lane layout).
// Every overlay portals into the nearest `.grammar-common-root`, so each visual family's scope still
// applies to it; see `src/core/overlayScope.tsx`.
import { AlertDialog } from "../core/branch/AlertDialog/index.js"
import { Dialog } from "../core/branch/Dialog/index.js"
import { Drawer } from "../core/branch/Drawer/index.js"
import { DropdownMenu } from "../core/branch/DropdownMenu/index.js"
import { Popover } from "../core/branch/Popover/index.js"
import { Toast, Toaster } from "../core/branch/Toast/index.js"
import { Alert } from "../core/composite/Alert/index.js"
import { CloseButton } from "../core/primitive/CloseButton/index.js"
import { Kbd } from "../core/primitive/Kbd/index.js"
import { Meter } from "../core/primitive/Meter/index.js"
import { ProgressCircle } from "../core/primitive/ProgressCircle/index.js"
import { Skeleton } from "../core/primitive/Skeleton/index.js"
import { Spinner } from "../core/primitive/Spinner/index.js"

export { AlertDialog, type AlertDialogProps } from "../core/branch/AlertDialog/index.js"
export { Dialog, type DialogProps, type DialogSize, type OverlayFooter } from "../core/branch/Dialog/index.js"
export { Drawer, type DrawerPlacement, type DrawerProps } from "../core/branch/Drawer/index.js"
export {
    DropdownMenu,
    type DropdownMenuEntry,
    type DropdownMenuItem,
    type DropdownMenuItemTone,
    type DropdownMenuPlacement,
    type DropdownMenuProps,
    type DropdownMenuSection,
    type DropdownMenuSelection,
} from "../core/branch/DropdownMenu/index.js"
export { Popover, type PopoverPlacement, type PopoverProps } from "../core/branch/Popover/index.js"
export {
    DEFAULT_TOAST_TIMEOUT,
    Toast,
    Toaster,
    createToastQueue,
    toastQueue,
    toastTimeoutFor,
    type ToastAction,
    type ToasterPlacement,
    type ToasterProps,
    type ToastOptions,
    type ToastProps,
    type ToastQueue,
    type ToastRecord,
} from "../core/branch/Toast/index.js"
export { Alert, type AlertAction, type AlertProps, type AlertUrgency } from "../core/composite/Alert/index.js"
export { CloseButton, type CloseButtonProps, type CloseButtonSize } from "../core/primitive/CloseButton/index.js"
export { KBD_NAMED_KEYS, Kbd, type KbdNamedKey, type KbdProps } from "../core/primitive/Kbd/index.js"
export { Meter, type MeterProps } from "../core/primitive/Meter/index.js"
export { ProgressCircle, type ProgressCircleProps, type ProgressCircleSize } from "../core/primitive/ProgressCircle/index.js"
export { Skeleton, type SkeletonProps, type SkeletonRatio, type SkeletonShape, type SkeletonSize } from "../core/primitive/Skeleton/index.js"
export { Spinner, type SpinnerProps, type SpinnerSize, type SpinnerTone } from "../core/primitive/Spinner/index.js"
export { GRAMMAR_ROOT_SELECTOR, resolveOverlayContainer, type OverlayOpenState } from "../core/overlayScope.js"

/** Overlay and feedback renderers merged into `COMMON_GRAMMAR_COMPONENTS`. */
export const COMMON_OVERLAYS_COMPONENTS = Object.freeze({
    Alert, AlertDialog, CloseButton, Dialog, Drawer, DropdownMenu, Kbd, Meter, Popover,
    ProgressCircle, Skeleton, Spinner, Toast, Toaster,
} as const)
