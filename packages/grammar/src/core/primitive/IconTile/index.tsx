import { cn, skeletonVariants } from "@heroui/react"
import type { ReactNode } from "react"
import { Icon, type IconSource } from "../Icon/index.js"

export type IconTileTone = "neutral" | "accent" | "success" | "warning" | "danger"
export type IconTileSize = "sm" | "md"

export type IconTileProps = {
    /** Fallback glyph selected by the app's semantic icon map. */
    readonly source: IconSource
    /** Optional app-owned artwork replaces the fallback glyph without changing plate geometry. */
    readonly artwork?: ReactNode
    readonly ariaLabel?: string
    readonly tone?: IconTileTone
    readonly size?: IconTileSize
    readonly isSkeleton?: boolean
}

/*
 * Plate size, corner and tone pair are SHIPPED by `.starci-core-icon-tile` in
 * `src/common/styles.css`, selected by the `data-size`, `data-tone`, `data-artwork` and
 * `data-loading` attributes this element already emits. The corner comes from the theme radius
 * ramp (`--radius-lg` / `--radius-xl`), not from a HeroUI v2 radius name.
 */

const SKELETON_CLASS_NAME = skeletonVariants({ animationType: "shimmer" }).base()

/**
 * surface.md Catalog / tone.md Scale: only these tone classes have a published rule for their exact
 * pairing. `bg-default` (neutral) and the warning/danger soft pairs are not catalogued, so they are
 * left unclaimed.
 */
const TONE_CONTRACT: Partial<Record<IconTileTone, string>> = {
    neutral: "TONE-2",
    accent: "SURFACE-4",
    success: "SURFACE-5",
}

/** Filled icon plate with one owned size, radius, tone pair, and loading geometry. */
export const IconTile = ({
    source,
    artwork,
    ariaLabel,
    tone = "neutral",
    size = "sm",
    isSkeleton = false,
}: IconTileProps) => {
    const showsArtwork = !isSkeleton && artwork != null
    const toneRule = isSkeleton || showsArtwork ? undefined : TONE_CONTRACT[tone]
    return (
        <span
            data-tier="atom"
            data-component="IconTile"
            data-tone={tone}
            data-size={size}
            data-artwork={showsArtwork ? "true" : "false"}
            data-loading={isSkeleton ? "true" : "false"}
            aria-hidden={isSkeleton || undefined}
            data-contract={["OVERFLOW-2", toneRule].filter(Boolean).join(" ")}
            className={cn("starci-core-icon-tile", isSkeleton ? SKELETON_CLASS_NAME : undefined)}
        >
            {isSkeleton ? null : showsArtwork ? artwork : (
                <Icon source={source} usage="leading" {...(ariaLabel === undefined ? {} : { ariaLabel })} />
            )}
        </span>
    )
}
