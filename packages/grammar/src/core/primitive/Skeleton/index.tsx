import { Skeleton as HeroSkeleton } from "@heroui/react"

export type SkeletonShape = "text" | "rect" | "circle"
export type SkeletonRatio = "square" | "landscape" | "wide"
export type SkeletonSize = "sm" | "md" | "lg"

export type SkeletonProps = {
    readonly shape?: SkeletonShape
    /** `text` only: how many lines the unresolved copy will take (1-12). The last line is shorter. */
    readonly lines?: number
    /** `rect` only: the aspect the resolved media or surface will take. */
    readonly ratio?: SkeletonRatio
    /** `circle` only: avatar or glyph footprint. */
    readonly size?: SkeletonSize
}

const clampLines = (lines: number) => Math.min(12, Math.max(1, Math.floor(Number.isFinite(lines) ? lines : 1)))

/**
 * ATOM - `Skeleton`: inert geometry for initial unresolved content.
 *
 * Always `aria-hidden`: the region that is loading owns `aria-busy`; a skeleton never announces.
 * Shape geometry and the reduced-motion rule (shimmer removed, static tint kept) are SHIPPED by
 * `.starci-core-skeleton` in `src/common/components-overlays.css`.
 */
export const Skeleton = ({ shape = "text", lines = 1, ratio = "landscape", size = "md" }: SkeletonProps) => {
    if (shape === "text") {
        const count = clampLines(lines)
        return (
            <span
                data-tier="atom"
                data-component="Skeleton"
                data-shape="text"
                data-lines={count}
                aria-hidden="true"
                className="starci-core-skeleton-group"
            >
                {Array.from({ length: count }, (_, index) => (
                    <HeroSkeleton
                        key={index}
                        animationType="shimmer"
                        className="starci-core-skeleton"
                        data-grammar-skeleton-line={index === count - 1 && count > 1 ? "last" : "line"}
                    />
                ))}
            </span>
        )
    }

    return (
        <HeroSkeleton
            animationType="shimmer"
            data-tier="atom"
            data-component="Skeleton"
            data-shape={shape}
            {...(shape === "rect" ? { "data-ratio": ratio } : { "data-size": size })}
            aria-hidden="true"
            className="starci-core-skeleton"
        />
    )
}
