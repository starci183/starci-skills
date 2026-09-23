"use client"

import { useId, useState, type ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"

export type RatingProps = {
    /** Names what is being rated. */
    readonly label: string
    /** Controlled value; 0 means unrated. Read-only ratings may be fractional (halves are drawn). */
    readonly value?: number
    readonly defaultValue?: number
    readonly onChange?: (value: number) => void
    readonly max?: number
    readonly isReadOnly?: boolean
    readonly isDisabled?: boolean
    /** App-owned accessible text for a value, e.g. "3 of 5 stars". */
    readonly valueLabel: (value: number, max: number) => string
    /** App-owned glyph; defaults to a neutral star outline filled by the stylesheet. */
    readonly icon?: ReactNode
    /** Form field name for the native radio set. */
    readonly name?: string
    readonly className?: string
}

const StarGlyph = () => (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="starci-core-rating-glyph" data-contract="ICON-6">
        <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z" />
    </svg>
)

const fillFor = (position: number, value: number): "full" | "half" | "empty" => {
    if (value >= position) return "full"
    if (value >= position - 0.5) return "half"
    return "empty"
}

/**
 * A 1..max rating. Interactive ratings are a native radio set, so arrow keys, form submission and
 * the radiogroup semantics come from the platform; read-only ratings are one labelled image.
 * Contract: read-only A11Y-3; radiogroup A11Y-3 FOCUS-2 CONTROL-STATE-3; option FOCUS-1; glyph ICON-6.
 */
export const Rating = ({
    label,
    value,
    defaultValue = 0,
    onChange,
    max = 5,
    isReadOnly = false,
    isDisabled = false,
    valueLabel,
    icon,
    name,
    className,
}: RatingProps) => {
    const [uncontrolled, setUncontrolled] = useState(defaultValue)
    const [preview, setPreview] = useState<number | null>(null)
    const generatedName = useId()
    const current = value ?? uncontrolled
    const positions = Array.from({ length: max }, (_, index) => index + 1)
    const glyph = icon ?? <StarGlyph />

    if (isReadOnly) {
        return (
            <span
                aria-label={`${label}: ${valueLabel(current, max)}`}
                className={navigationClassName("starci-core-rating", className)}
                data-component="Rating"
                data-tier="atom"
                data-contract="A11Y-3"
                data-grammar-rating-mode="read-only"
                role="img"
            >
                {positions.map((position) => (
                    <span key={position} className="starci-core-rating-item" data-grammar-rating-fill={fillFor(position, current)}>{glyph}</span>
                ))}
            </span>
        )
    }

    const shown = preview ?? current
    const select = (next: number) => {
        if (value === undefined) setUncontrolled(next)
        onChange?.(next)
    }
    return (
        <span
            aria-disabled={isDisabled || undefined}
            aria-label={label}
            className={navigationClassName("starci-core-rating", className)}
            data-component="Rating"
            data-tier="atom"
            data-contract="A11Y-3 FOCUS-2 CONTROL-STATE-3"
            data-grammar-rating-mode="interactive"
            data-grammar-disabled={isDisabled ? "true" : "false"}
            onPointerLeave={() => setPreview(null)}
            role="radiogroup"
        >
            {positions.map((position) => (
                <label
                    key={position}
                    className="starci-core-rating-item"
                    data-contract="FOCUS-1"
                    data-grammar-rating-fill={fillFor(position, shown)}
                    data-grammar-selected={Math.round(current) === position ? "true" : "false"}
                    onPointerEnter={() => { if (!isDisabled) setPreview(position) }}
                >
                    <input
                        aria-label={valueLabel(position, max)}
                        checked={Math.round(current) === position}
                        className="starci-core-rating-input"
                        disabled={isDisabled}
                        name={name ?? generatedName}
                        onChange={() => select(position)}
                        type="radio"
                        value={position}
                    />
                    {glyph}
                </label>
            ))}
        </span>
    )
}
