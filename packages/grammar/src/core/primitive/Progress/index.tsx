import { ProgressBar, skeletonVariants } from "@heroui/react"

export type ProgressProps = {
    /** What the bar measures. Required because the visible bar has no drawn label. */
    readonly label: string
    /** Completion from 0 to 100. Validation remains with the resolving application. */
    readonly value?: number
    /** Initial unresolved-content geometry, not a zero-valued measurement. */
    readonly isSkeleton?: boolean
}

/**
 * Fluid width and the resting bar's height are SHIPPED by `.starci-core-progress` in
 * `src/common/styles.css`, keyed by `data-loading`.
 */
const SKELETON_CLASS_NAME = skeletonVariants({ animationType: "shimmer" }).base({
    className: "starci-core-progress",
})

/** Accessible, full-width completion bar with an inert initial-loading shape. */
export const Progress = ({ label, value = 0, isSkeleton = false }: ProgressProps) => {
    if (isSkeleton) {
        return (
            <span
                data-tier="atom"
                data-component="Progress"
                data-loading="true"
                aria-hidden
                // Fluid width matches MEASURE-2. The resting bar's 0.5rem height is a fixed
                // height, which measure.md excludes from its catalog on purpose, so it stays unclaimed.
                data-contract="MEASURE-2"
                className={SKELETON_CLASS_NAME}
            />
        )
    }

    return (
        <ProgressBar
            data-tier="atom"
            data-component="Progress"
            data-loading="false"
            aria-label={label}
            value={value}
            minValue={0}
            maxValue={100}
            color="accent"
            size="sm"
            // Fluid width matches MEASURE-2 in measure.md `## Scale`/catalog.
            data-contract="MEASURE-2"
            className="starci-core-progress"
        >
            <ProgressBar.Track>
                <ProgressBar.Fill />
            </ProgressBar.Track>
        </ProgressBar>
    )
}
