import { skeletonVariants } from "@heroui/react"
import type { ComponentType, SVGProps } from "react"

export type IconUsage = "heading" | "leading" | "chip"
/**
 * Minimal structural contract passed to an app-owned SVG glyph.
 *
 * This deliberately does not expose React's SVGProps in the public declaration. File-linked
 * consumers can carry a different compatible @types/react installation, whose private ref symbol
 * must not become part of Grammar's package boundary.
 */
export type IconSourceProps = {
    readonly className?: string
    readonly focusable?: "false"
    readonly role?: "img"
    readonly "aria-hidden"?: boolean
    readonly "aria-label"?: string
    readonly "data-tier"?: string
    readonly "data-component"?: string
    readonly "data-usage"?: string
}

/** Function or class SVG glyph selected by the consuming app's icon registry. */
export type IconSource =
    | ((props: IconSourceProps) => unknown)
    | (new (props: IconSourceProps) => unknown)

export type IconProps = {
    /** App-owned glyph identity. Grammar owns only its usage geometry and accessibility. */
    readonly source: IconSource
    readonly usage?: IconUsage
    /** Omit for a decorative glyph; provide when the icon itself carries meaning. */
    readonly ariaLabel?: string
    readonly isSkeleton?: boolean
}

/*
 * Usage sizing is SHIPPED by `.starci-core-icon[data-usage]` in `src/common/styles.css`, and the
 * resting glyph by `.starci-core-icon-skeleton`. A glyph sized only by a Tailwind utility collapses
 * to the SVG default box in any consumer whose build does not scan this package.
 */
const ICON_CLASS_NAME = "starci-core-icon"

const SKELETON_CLASS_NAME = skeletonVariants({ animationType: "shimmer" }).base({
    className: "starci-core-icon-skeleton",
})

/** Product-neutral icon carrier; semantic glyph names and libraries remain app authority. */
export const Icon = ({ source: Source, usage = "chip", ariaLabel, isSkeleton = false }: IconProps) => {
    if (isSkeleton) {
        return <span data-tier="atom" data-component="Icon" data-loading="true" aria-hidden className={SKELETON_CLASS_NAME} />
    }

    // The private cast is the only React-type identity boundary. Consumers see the structural
    // IconSource contract above, while JSX still receives the local React component type.
    const SourceComponent = Source as ComponentType<SVGProps<SVGSVGElement>>
    return (
        <SourceComponent
            data-tier="atom"
            data-component="Icon"
            data-usage={usage}
            focusable="false"
            className={ICON_CLASS_NAME}
            {...(ariaLabel === undefined
                ? { "aria-hidden": true as const }
                : { "aria-label": ariaLabel, role: "img" as const })}
        />
    )
}
