import type { ReactNode } from "react"
import { Image, SurfaceCard, Text } from "@starci/grammar/common"
import { catalogueTileClassNames } from "./classNames"

/** What one catalogue tile shows: the name, the price, an optional blurb and image, and an optional tail. */
export type CatalogueTileProps = {
    /** The product's display name, already resolved. */
    readonly name: string
    /** The price as a formatted display string; the app owns the amount and the currency. */
    readonly price: string
    /** A short editorial line, rendered only when present. */
    readonly blurb?: string
    /** A service-provided image URL; absent rows render a neutral initial-letter tile. */
    readonly imageUrl?: string
    /** Optional tile tail - the owning page slots its affordance (e.g. an add-to-cart control) here. */
    readonly children?: ReactNode
}

/**
 * One catalogue tile: the grammar `SurfaceCard` carries the name in its label and the price as the
 * label-row fact. A served `imageUrl` renders through grammar's `Image` with its reserved ratio; rows
 * without one get a neutral initial-letter tile, so the grid ships no broken or fabricated image URL.
 * `height="fill"` lets a grid row stretch every card evenly.
 */
export const CatalogueTile = (props: CatalogueTileProps) => (
    <SurfaceCard label={props.name} fact={props.price} height="fill">
        {props.imageUrl ? (
            <Image src={props.imageUrl} alt={props.name} aspect="landscape" fit="cover" />
        ) : (
            <div aria-hidden="true" className={catalogueTileClassNames.fallback}>
                {props.name.slice(0, 1).toUpperCase()}
            </div>
        )}
        {props.blurb ? (
            <Text size="sm" tone="muted">
                {props.blurb}
            </Text>
        ) : null}
        {props.children}
    </SurfaceCard>
)
