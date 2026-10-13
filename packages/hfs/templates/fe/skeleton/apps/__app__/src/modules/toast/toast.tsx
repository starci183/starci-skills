import { toast as heroToast } from "@heroui/react"
import { CheckCircleIcon, InfoIcon, WarningIcon, XCircleIcon } from "@phosphor-icons/react"
import type { ReactNode } from "react"

/** The options a status toast takes: HeroUI's, minus the variant the status already names. */
type StatusToastOptions = Parameters<typeof heroToast.success>[1]

/** The one indicator of each status, from the app's one icon set. */
const INDICATOR: Record<"success" | "danger" | "warning" | "info", ReactNode> = {
    success: <CheckCircleIcon className="size-6 text-success" />,
    danger: <XCircleIcon className="size-6 text-danger" />,
    warning: <WarningIcon className="size-6 text-warning" />,
    info: <InfoIcon className="size-6 text-accent" />,
}

/** The app's toast: HeroUI's imperative toast with the status indicator injected; the region is mounted by the providers. */
export const toast = {
    ...heroToast,
    success: (message: ReactNode, options?: StatusToastOptions) =>
        heroToast.success(message, { indicator: INDICATOR.success, ...options }),
    danger: (message: ReactNode, options?: StatusToastOptions) =>
        heroToast.danger(message, { indicator: INDICATOR.danger, ...options }),
    warning: (message: ReactNode, options?: StatusToastOptions) =>
        heroToast.warning(message, { indicator: INDICATOR.warning, ...options }),
    info: (message: ReactNode, options?: StatusToastOptions) =>
        heroToast.info(message, { indicator: INDICATOR.info, ...options }),
}
