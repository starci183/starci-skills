import { Chip, skeletonVariants } from "@heroui/react"
import type { ReactNode } from "react"

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger"

export type BadgeProps = {
    readonly children?: ReactNode
    /** App-owned status glyph or artwork. */
    readonly startContent?: ReactNode
    readonly tone?: BadgeTone
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

/** Compact semantic status or figure; product glyph identity remains app-owned. */
export const Badge = ({ children, startContent, tone = "neutral", isSkeleton = false }: BadgeProps) => (
    <Chip
        data-tier="atom"
        data-component="Badge"
        data-tone={tone}
        data-loading={isSkeleton ? "true" : "false"}
        color={TONE_COLORS[tone]}
        variant="soft"
        size="sm"
        {...(isSkeleton ? { "aria-hidden": true, className: SKELETON_CLASS_NAME } : {})}
    >
        {isSkeleton ? null : startContent}
        {children ?? "\u00a0"}
    </Chip>
)
