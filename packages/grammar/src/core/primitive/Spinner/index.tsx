import { Spinner as HeroSpinner } from "@heroui/react"

export type SpinnerSize = "sm" | "md" | "lg"
export type SpinnerTone = "accent" | "current"

export type SpinnerProps = {
    /** What is loading. Announced through `role="status"`; there is no silent spinner. */
    readonly label: string
    readonly size?: SpinnerSize
    /** `current` inherits the surrounding text colour (inside a button or a toned banner). */
    readonly tone?: SpinnerTone
}

/**
 * ATOM - `Spinner`: indeterminate, action-owned waiting.
 *
 * Use it for work a person started and is waiting on; initial unresolved content uses `Skeleton`.
 * Under `prefers-reduced-motion: reduce` the rotation is replaced by a slow opacity pulse
 * (`src/common/components-overlays.css`), so the busy state stays perceivable without spinning.
 */
export const Spinner = ({ label, size = "md", tone = "accent" }: SpinnerProps) => (
    <HeroSpinner
        data-tier="atom"
        data-component="Spinner"
        data-size={size}
        data-tone={tone}
        role="status"
        aria-label={label}
        size={size}
        color={tone}
        className="starci-core-spinner"
    />
)
