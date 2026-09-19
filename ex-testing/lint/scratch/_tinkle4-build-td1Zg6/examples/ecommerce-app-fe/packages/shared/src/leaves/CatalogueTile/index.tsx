"use client"

import type { ReactNode } from "react"
import { MediaFrame, SurfaceCard, Text } from "@starci/grammar/common"
import { catalogueTileClassNames } from "./classNames"

export type CatalogueTileProps = {
  /** The product's display name, already resolved. */
  readonly name: string;
  /** The price as a formatted display string; the app owns the amount and the currency. */
  readonly price: string;
  /** A short editorial line, rendered only when present. */
  readonly blurb?: string;
  /** A service-provided image URL; absent rows render a neutral initial-letter tile. */
  readonly imageUrl?: string;
  /** Optional tile tail - the owning page slots its affordance (e.g. an add-to-cart control) here. */
  readonly children?: ReactNode;
};

/**
 * One catalogue tile: the grammar `SurfaceCard` carries the name in its label and the price as the
 * label-row fact. A served `imageUrl` renders through `MediaFrame`; rows without one get a neutral
 * initial-letter tile, so the grid ships no broken or fabricated image URL. `height="fill"` lets a
 * grid row stretch every card evenly.
 */
export const CatalogueTile = (props: CatalogueTileProps) => (
    <SurfaceCard
        label={props.name}
        fact={props.price}
        height="fill"
    >
        {props.imageUrl ? (
            <MediaFrame aspect="landscape" fit="cover">
                {/* The service owns the URL; next/image has no remote pattern for it yet. */}
                <img src={props.imageUrl} alt="" className={catalogueTileClassNames.image} />
            </MediaFrame>
        ) : (
            <div
                aria-hidden="true"
                className={catalogueTileClassNames.fallback}
            >
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
