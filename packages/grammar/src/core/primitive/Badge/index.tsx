import { Chip, skeletonVariants } from "@heroui/react"
import type { ReactNode } from "react"
import { CircleFill } from "../../CircleFill.js"

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger"

export type BadgeProps = {
    readonly children?: ReactNode
    /** App-owned status glyph or artwork. */
    readonly startContent?: ReactNode
    readonly tone?: BadgeTone
    /**
     * A leading status dot: HeroUI's Chip-with-dot (`<CircleFill width={6} />`), a 6px solid circle in the
     * badge's tone colour (`currentColor`), `aria-hidden`, before the label. No halo, ring or size variant.
     */
    readonly isDot?: boolean
    readonly isSkeleton?: boolean
}

const TONE_COLORS = {
    neutral: "default",
    accent: "accent",
    success: "success",
    warning: "warning",
    danger: "danger",
} as const

const SKELETON_CLASS_NAME = skeletonVariants({ animationType: "shimmer" }).base({
    className: "select-none text-transparent",
})

/**
 * Compact semantic status or figure; product glyph identity remains app-owned. `isDot` adds the
 * Grammar's own leading status dot (a 6px `CircleFill` in the tone colour, class `starci-core-badge-dot`).
 *
 * Contract: ICON-2 (the glyph and its words share one status owner) and TRUTH-1 (the tone is stated,
 * never inferred, and defaults to neutral).
 */
export const Badge = ({ children, startContent, tone = "neutral", isDot = false, isSkeleton = false }: BadgeProps) => (
    <Chip
        data-tier="atom"
        data-component="Badge"
        data-contract="ICON-2 TRUTH-1"
        data-tone={tone}
        data-grammar-badge-dot={isDot && !isSkeleton ? "true" : undefined}
        data-loading={isSkeleton ? "true" : "false"}
        color={TONE_COLORS[tone]}
        variant="soft"
        size="sm"
        {...(isSkeleton ? { "aria-hidden": true, className: SKELETON_CLASS_NAME } : {})}
    >
        {isDot && !isSkeleton ? <CircleFill width={6} className="starci-core-badge-dot" /> : null}
        {isSkeleton ? null : startContent}
        {children ?? "\u00a0"}
    </Chip>
)
