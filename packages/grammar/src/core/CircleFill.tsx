/** Props for the filled-circle glyph: its rendered box, in CSS pixels. */
export type CircleFillProps = {
    readonly width?: number
    readonly className?: string
}

/**
 * A solid circle in `currentColor`: the status dot HeroUI's Chip examples draw with `<CircleFill width={6} />`.
 *
 * Upstream Heroicons has no filled circle, so the Grammar draws this plain geometric mark itself, cut the
 * way StarCi's registered custom micro glyphs are (`@starci/heroicons` 16/solid `CircleIcon`): a 16 x 16
 * viewBox, `fill="currentColor"`, `data-slot="icon"`. It is decorative only (ICON-6): always `aria-hidden`,
 * never focusable; the words beside it carry the meaning.
 */
export const CircleFill = ({ width = 6, className }: CircleFillProps) => (
    <svg
        aria-hidden="true"
        className={className}
        data-slot="icon"
        fill="currentColor"
        focusable="false"
        height={width}
        viewBox="0 0 16 16"
        width={width}
        xmlns="http://www.w3.org/2000/svg"
    >
        <circle cx="8" cy="8" r="8" />
    </svg>
)
