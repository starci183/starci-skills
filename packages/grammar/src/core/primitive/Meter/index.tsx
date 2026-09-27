import { Label as HeroLabel, Meter as HeroMeter } from "@heroui/react"
import type { ComponentPropsWithRef } from "react"
import type { PresentationState } from "../../../common/state.js"
import { vendorStatusFor } from "../../overlayScope.js"

/**
 * How many equal parts a segmented meter draws: a discrete count such as "2 of 3 capabilities".
 * A closed range, 2..12 - one part is a plain meter and more than twelve stops reading as a count.
 */
export type MeterSegments = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export type MeterProps = {
    /** What the gauge measures. Visible by default and wired as the meter's accessible name. */
    readonly label: string
    readonly value: number
    readonly minValue?: number
    readonly maxValue?: number
    /** App-resolved reading, e.g. "3.2 of 5 GB". Defaults to the platform percentage. */
    readonly valueLabel?: string
    /** How the reading should be judged. It colours the fill; it never replaces the label. */
    readonly tone?: PresentationState
    /** Hide the drawn label and reading but keep the accessible name. */
    readonly isLabelHidden?: boolean
    /**
     * Draw the track as this many equal, separately rounded segments instead of one continuous fill.
     * The track keeps the plain meter's geometry (full container width, 0.5rem high); segments sit
     * 0.25rem apart. The reading becomes a whole count: `value`, `minValue` and `maxValue` are rounded
     * to integers and the value clamped into range, and `round((value - min) / (max - min) * segments)`
     * segments fill. The segments are presentational (`aria-hidden`): the one `role="meter"` keeps the
     * accessible name and `aria-value*`. Out-of-range counts from untyped callers clamp to 2..12.
     */
    readonly segments?: MeterSegments
}

const MIN_SEGMENTS = 2
const MAX_SEGMENTS = 12

/** A whole segment count in 2..12, whatever an untyped caller passed. */
const clampSegments = (segments: number) => Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, Math.round(Number.isFinite(segments) ? segments : MIN_SEGMENTS)))

/** A segmented meter reads whole counts; a non-finite bound falls back to the plain default. */
const wholeNumber = (value: number, fallback: number) => (Number.isFinite(value) ? Math.round(value) : fallback)

/**
 * ATOM - `Meter`: a static reading inside a known range (`role="meter"`).
 *
 * The role is exactly `meter` (ARIA 1.2), never React Aria's `"meter progressbar"` fallback list:
 * validators resolve a role list to an unsupported token and reject the `aria-value*` attributes
 * (axe 4.13 `aria-allowed-attr`), while every current engine exposes `meter` (Chromium, WebKit
 * and Gecko map it to a level indicator / progress bar natively).
 *
 * Unlike `Progress`, a meter is not work moving toward completion. Tone is a PresentationState and is
 * echoed on `data-grammar-tone` for family treatments. `segments` draws a discrete count (3 of 3,
 * 2 of 3) as equal segments on the same track; the root echoes the count on
 * `data-grammar-meter-segments` and each segment its state on `data-grammar-meter-segment`.
 */
const renderMeterRoot = (domProps: ComponentPropsWithRef<"div">) => <div {...domProps} role="meter" />

export const Meter = ({
    label,
    value,
    minValue = 0,
    maxValue = 100,
    valueLabel,
    tone = "neutral",
    isLabelHidden = false,
    segments,
}: MeterProps) => {
    const status = vendorStatusFor(tone)
    const count = segments === undefined ? undefined : clampSegments(segments)
    const min = count === undefined ? minValue : wholeNumber(minValue, 0)
    const max = count === undefined ? maxValue : Math.max(min + 1, wholeNumber(maxValue, 100))
    const reading = count === undefined ? value : Math.min(max, Math.max(min, wholeNumber(value, min)))
    const filled = count === undefined ? 0 : Math.round(((reading - min) / (max - min)) * count)
    return (
        <HeroMeter
            data-tier="atom"
            data-component="Meter"
            data-grammar-tone={tone}
            data-contract="A11Y-3 ACCENT-4"
            value={reading}
            minValue={min}
            maxValue={max}
            {...(count === undefined ? {} : { "data-grammar-meter-segments": count })}
            {...(valueLabel === undefined ? {} : { valueLabel })}
            {...(isLabelHidden ? { "aria-label": label } : {})}
            color={status === "default" ? "accent" : status}
            size="md"
            className="starci-core-meter"
            render={renderMeterRoot}
        >
            {isLabelHidden ? null : (
                <span className="starci-core-meter-header">
                    <HeroLabel className="starci-core-meter-label">{label}</HeroLabel>
                    <HeroMeter.Output className="starci-core-meter-output" />
                </span>
            )}
            {count === undefined ? (
                <HeroMeter.Track className="starci-core-meter-track">
                    <HeroMeter.Fill className="starci-core-meter-fill" data-contract="MOTION-2" />
                </HeroMeter.Track>
            ) : (
                <HeroMeter.Track className="starci-core-meter-track starci-core-meter-segments">
                    {Array.from({ length: count }, (_, index) => (
                        <span
                            key={index}
                            aria-hidden="true"
                            className="starci-core-meter-segment"
                            data-grammar-meter-segment={index < filled ? "filled" : "empty"}
                        />
                    ))}
                </HeroMeter.Track>
            )}
        </HeroMeter>
    )
}
