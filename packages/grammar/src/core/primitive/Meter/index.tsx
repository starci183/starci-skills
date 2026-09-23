import { Label as HeroLabel, Meter as HeroMeter } from "@heroui/react"
import type { ComponentPropsWithRef } from "react"
import type { PresentationState } from "../../../common/state.js"
import { vendorStatusFor } from "../../overlayScope.js"

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
}

/**
 * ATOM - `Meter`: a static reading inside a known range (`role="meter"`).
 *
 * The role is exactly `meter` (ARIA 1.2), never React Aria's `"meter progressbar"` fallback list:
 * validators resolve a role list to an unsupported token and reject the `aria-value*` attributes
 * (axe 4.13 `aria-allowed-attr`), while every current engine exposes `meter` (Chromium, WebKit
 * and Gecko map it to a level indicator / progress bar natively).
 *
 * Unlike `Progress`, a meter is not work moving toward completion. Tone is a PresentationState and is
 * echoed on `data-grammar-tone` for family treatments.
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
}: MeterProps) => {
    const status = vendorStatusFor(tone)
    return (
        <HeroMeter
            data-tier="atom"
            data-component="Meter"
            data-grammar-tone={tone}
            value={value}
            minValue={minValue}
            maxValue={maxValue}
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
            <HeroMeter.Track className="starci-core-meter-track">
                <HeroMeter.Fill className="starci-core-meter-fill" />
            </HeroMeter.Track>
        </HeroMeter>
    )
}
