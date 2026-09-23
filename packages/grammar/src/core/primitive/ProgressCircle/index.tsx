import { ProgressCircle as HeroProgressCircle } from "@heroui/react"

export type ProgressCircleSize = "sm" | "md" | "lg"

export type ProgressCircleProps = {
    /** What the ring measures. Required: the ring draws no label of its own. */
    readonly label: string
    /** Completion from 0 to 100. Ignored while indeterminate. */
    readonly value?: number
    /** Work with no knowable completion; the ring is announced without a value. */
    readonly isIndeterminate?: boolean
    readonly size?: ProgressCircleSize
}

/** ATOM - `ProgressCircle`: compact circular completion, the ring counterpart of `Progress`. */
export const ProgressCircle = ({ label, value = 0, isIndeterminate = false, size = "md" }: ProgressCircleProps) => (
    <HeroProgressCircle
        data-tier="atom"
        data-component="ProgressCircle"
        data-size={size}
        data-indeterminate={isIndeterminate ? "true" : "false"}
        aria-label={label}
        minValue={0}
        maxValue={100}
        {...(isIndeterminate ? { isIndeterminate: true } : { value })}
        color="accent"
        size={size}
        className="starci-core-progress-circle"
    >
        <HeroProgressCircle.Track>
            <HeroProgressCircle.TrackCircle />
            <HeroProgressCircle.FillCircle />
        </HeroProgressCircle.Track>
    </HeroProgressCircle>
)
