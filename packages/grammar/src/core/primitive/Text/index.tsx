import { skeletonVariants } from "@heroui/react"
import type { ReactNode } from "react"

export type TextAs = "div" | "p" | "span"
export type TextTone = "default" | "muted" | "accent"
export type TextSize = "xs" | "sm" | "md" | "metric-lead"
export type TextWeight = "normal" | "medium" | "semibold"
export type TextLive = "off" | "polite" | "assertive"
export type TextOverflow = "wrap" | "truncate" | "clamp-2"

export type TextProps = {
    /** Select the semantic line owner without exposing styling hooks. */
    readonly as?: TextAs
    readonly id?: string
    readonly children?: ReactNode
    /** App-owned glyph or other inline meaning placed before the copy. */
    readonly startContent?: ReactNode
    readonly size?: TextSize
    readonly tone?: TextTone
    readonly weight?: TextWeight
    readonly live?: TextLive
    /**
     * How the line answers copy longer than its box: wrap it, cut it with an ellipsis, or clamp it
     * to two lines. Shipped by `.starci-core-text[data-overflow]`, so no consumer has to reach
     * through the boundary with a descendant selector on `[data-size]` to force one.
     */
    readonly overflow?: TextOverflow
    readonly isSkeleton?: boolean
    readonly isSuperseded?: boolean
    /** Opt into the shared selected-parent accent treatment. */
    readonly parentEmphasis?: "accent-soft"
}

const LIVE_ROLES = { off: undefined, polite: "status", assertive: "alert" } as const

/**
 * Copy geometry and paint are SHIPPED.
 *
 * `.starci-core-text` in `src/common/styles.css` reads the `data-size`, `data-tone`, `data-weight`,
 * `data-start-content`, `data-superseded`, `data-parent-emphasis` and `data-loading` attributes this
 * element already emits, so a consumer gets the scale without scanning this package with Tailwind.
 */
const TEXT_CLASS_NAME = "starci-core-text"

const FONT_RULE_BY_SIZE: Record<TextSize, string> = {
    xs: "FONT-1",
    sm: "FONT-2",
    md: "FONT-3",
    "metric-lead": "FONT-5",
}

const TONE_RULE_BY_RESOLVED_TONE: Record<TextTone, string> = {
    default: "TONE-1",
    muted: "TONE-2",
    accent: "TONE-3",
}

/**
 * Rule ids this element can claim from its resolved size and tone.
 * `size` selects the exact scale row in font.md `## Scale` (FONT-1/2/3/5); the
 * resolved tone (forced `muted` at `size="xs"`) selects the exact row in
 * tone.md `## Scale` (TONE-1/2/3). the 0.5rem inline gap fires only while `startContent`
 * is shown, matching the `Text` with `startContent` row in gap.md's
 * "Gaps Common already owns" table (GAP-2). Weight classes (`font-medium`,
 * `font-semibold`) and the `parentEmphasis` accent-soft variant carry no rule
 * id here and stay unclaimed.
 */
const getTextContract = (size: TextSize, resolvedTone: TextTone, showsStartContent: boolean) => {
    const ids = [FONT_RULE_BY_SIZE[size], TONE_RULE_BY_RESOLVED_TONE[resolvedTone]]
    if (showsStartContent) ids.push("GAP-2")
    return ids.join(" ")
}

/**
 * The skeleton keeps the size geometry (FONT-1/2/3/5) but its copy is
 * `text-transparent`, so no tone is actually visible to claim.
 */
const getTextSkeletonContract = (size: TextSize) => FONT_RULE_BY_SIZE[size]

const SKELETON_CLASS_NAME = skeletonVariants({ animationType: "shimmer" }).base({
    className: TEXT_CLASS_NAME,
})

/** One resolved line of copy with explicit semantics, hierarchy and announcement behavior. */
export const Text = ({
    as: Element = "div",
    id,
    children,
    startContent,
    size = "md",
    tone,
    weight = "normal",
    live = "off",
    overflow,
    isSkeleton = false,
    isSuperseded = false,
    parentEmphasis,
}: TextProps) => {
    const resolvedTone = size === "xs" ? "muted" : tone ?? "default"
    const showsStartContent = startContent != null && !isSkeleton

    return (
        <Element
            id={id}
            data-tier="atom"
            data-component="Text"
            data-size={size}
            data-tone={resolvedTone}
            data-weight={weight}
            data-start-content={showsStartContent ? "true" : "false"}
            data-superseded={isSuperseded ? "true" : "false"}
            data-parent-emphasis={parentEmphasis}
            data-live={live}
            data-overflow={overflow}
            data-loading={isSkeleton ? "true" : "false"}
            data-contract={isSkeleton ? getTextSkeletonContract(size) : getTextContract(size, resolvedTone, showsStartContent)}
            role={isSkeleton ? undefined : LIVE_ROLES[live]}
            aria-live={isSkeleton || live === "off" ? undefined : live}
            aria-hidden={isSkeleton || undefined}
            className={isSkeleton ? SKELETON_CLASS_NAME : TEXT_CLASS_NAME}
        >
            {showsStartContent ? startContent : null}
            {isSkeleton ? "\u00a0" : children}
        </Element>
    )
}
