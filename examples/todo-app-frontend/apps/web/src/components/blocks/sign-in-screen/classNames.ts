import { cn } from "@heroui/react"

/**
 * The left welcome panel on the brand canvas. Once the rail container is wide enough for two tracks
 * the panel stretches to the full viewport height; collapsed it stays a compact banner above the
 * form, in the same order the published collapsedOrder ships.
 */
export const SIGN_IN_WELCOME_PANEL_CLASS = cn(
    "flex",
    "h-full",
    "flex-col",
    "bg-background",
    "p-6",
    "@[56.001rem]/starci-core-primary-rail:min-h-dvh",
    "@[56.001rem]/starci-core-primary-rail:p-16",
)

/** The product line block inside the welcome panel: slogan and tagline under the wordmark. */
export const SIGN_IN_WELCOME_COPY_CLASS = cn(
    "mt-8",
    "flex",
    "flex-col",
    "gap-3",
    "@[56.001rem]/starci-core-primary-rail:mt-24",
)

/** The artwork region fills the welcome panel's remaining height and centres the turtle in it. */
export const SIGN_IN_WELCOME_ART_CLASS = cn("mt-8", "flex", "flex-1", "items-center", "justify-center")

/** Compact turtle on the collapsed banner; half the panel's measure once the shell expands. */
export const SIGN_IN_TURTLE_FRAME_CLASS = cn("w-40", "@[56.001rem]/starci-core-primary-rail:w-1/2")

/** The master is drawn on a white field; multiply drops it onto the canvas panel like the direction. */
export const SIGN_IN_TURTLE_IMAGE_CLASS = cn("mix-blend-multiply")

/** The right form panel: white surface, full height under the expanded shell, natural when collapsed. */
export const SIGN_IN_FORM_PANEL_CLASS = cn(
    "flex",
    "h-full",
    "flex-col",
    "bg-surface",
    "p-6",
    "@[56.001rem]/starci-core-primary-rail:p-12",
)

/** The form column centres vertically in the expanded panel and flows naturally when collapsed. */
export const SIGN_IN_FORM_MAIN_CLASS = cn("flex", "flex-1", "flex-col", "justify-center", "gap-6")

/** The form heading pair: section title over the muted guidance line. */
export const SIGN_IN_HEADING_CLASS = cn("flex", "flex-col", "gap-2")

/** Field and submit stack inside the sign-in form. */
export const SIGN_IN_FORM_CLASS = cn("flex", "flex-col", "gap-4")

/** The forgot-password destination sits under the password field, at its trailing edge. */
export const SIGN_IN_FORGOT_ROW_CLASS = cn("flex", "justify-end")

/** The submit well: the button fills the form's measure. */
export const SIGN_IN_SUBMIT_WRAP_CLASS = cn("w-full")

/** The create-account line beside the form: quiet copy plus the destination. */
export const SIGN_IN_CREATE_ROW_CLASS = cn("flex", "items-center", "gap-1")

/** The policy footer pinned to the bottom of the form panel. */
export const SIGN_IN_FOOTER_CLASS = cn("mt-auto", "flex", "items-center", "justify-center", "gap-3", "pt-8")
