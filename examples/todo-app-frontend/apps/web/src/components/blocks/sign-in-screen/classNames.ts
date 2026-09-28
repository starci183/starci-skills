import { cn } from "@heroui/react"

/**
 * The screen's only landmark: full-bleed so the PrimaryRailLayout tracks reach the viewport edges.
 * The app's legacy `main` rule (a centred 32rem column) is overridden with important utilities rather
 * than edited, because globals.css is shared outside this screen's ownership.
 */
export const SIGN_IN_MAIN_CLASS = cn("min-h-dvh", "w-full", "max-w-none!", "m-0!", "p-0!")

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
export const SIGN_IN_WELCOME_COPY_CLASS = cn("mt-8", "flex", "flex-col", "gap-3", "@[56.001rem]/starci-core-primary-rail:mt-24")

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

/** Positions the forgot-password destination beside the password label, not inside it. */
export const SIGN_IN_PASSWORD_FIELD_CLASS = cn("relative")

/**
 * The forgot-password destination sits on the label row. The resting underline and its accent colour
 * are the product link recipe the direction corrected to; Grammar's text-action keeps the rest.
 */
export const SIGN_IN_FORGOT_LINK_CLASS = cn(
    "absolute",
    "-top-4",
    "end-0",
    "[&_.starci-core-text-action]:underline",
    "[&_.starci-core-text-action]:decoration-accent",
)

/** The product link recipe the direction settles: dark text-action labels underlined in the accent. */
export const SIGN_IN_LINK_RECIPE_CLASS = cn(
    "[&_.starci-core-text-action]:underline",
    "[&_.starci-core-text-action]:decoration-accent",
)

/**
 * The submit well. Enabled the primary variant paints its own accent fill; unavailable the outline
 * variant stays transparent so this well's accent-soft reads as the direction's tinted fill, with the
 * accent edge and black label the direction draws. The disabled-opacity token is scoped up because the
 * direction's unavailable treatment is fully readable - a deviation Grammar still owns
 * (ui.login.sign-in gap GRAMMAR_REQUIRED), approximated here at the token seam.
 */
export const SIGN_IN_SUBMIT_WRAP_CLASS = cn(
    "w-full",
    "rounded-3xl",
    "bg-accent-soft",
    "[--color-border:var(--color-accent)]",
    "[--accent-foreground:var(--color-black)]",
    "[--disabled-opacity:1]",
)

/** The create-account line beside the form: quiet copy plus the underlined destination. */
export const SIGN_IN_CREATE_ROW_CLASS = cn("flex", "items-center", "gap-1")

/** The policy footer pinned to the bottom of the form panel. */
export const SIGN_IN_FOOTER_CLASS = cn("mt-auto", "flex", "items-center", "justify-center", "gap-3", "pt-8")

/** The decorative separator between the two policy destinations. */
export const SIGN_IN_FOOTER_SEPARATOR_CLASS = cn("text-muted")
