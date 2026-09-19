export type ActionAppearance = "inline" | "muted" | "choice" | "route" | "tab" | "section" | "disclosure" | "plain"
export type ActionTextSize = "xs" | "sm" | "md"

/**
 * One typography/selection recipe shared by native links and text-styled actions.
 *
 * The recipe itself is SHIPPED: `.starci-core-text-action` in `src/common/styles.css` reads
 * `data-appearance`, `data-size` and `data-current` from the element, so every appearance - its
 * scale, corner, inset, tone and current-state surface - exists without a consumer's Tailwind build
 * scanning this package. `group` stays here as the marker a descendant `Text` selects its
 * selected-parent accent through; it is a hook, not a utility, and emits nothing on its own.
 */
export const getActionClassName = () => "group starci-core-text-action"
