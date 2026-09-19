"use client"

import { SectionHeader, Text } from "@starci/grammar/common"
import { CatalogueTile } from "@shared/leaves/CatalogueTile"
import { StateBlock } from "@shared/leaves/StateBlock"
import type { Product } from "../../../modules/api/catalog"
import { formatPrice } from "../../../modules/money"
import { browsePageClassNames } from "./classNames"
import { AddToCartControl } from "../../blocks/AddToCart"

/** The screen situations a catalogue read can settle. */
export type BrowsePageState = "signedOut" | "failed" | "empty" | "ready"

/** The browse page's resolved inputs: every string and the product payload already settled. */
export type BrowsePageProps = {
    /** Whole-screen situations this surface settles. */
    readonly state: BrowsePageState
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly title: string
        readonly description: string
        readonly products: ReadonlyArray<Product>
        readonly stockLabel: string
        readonly addToCart: string
        readonly addingToCart: string
        readonly inCartLabel: string
        readonly addRefused: string
        readonly signedOutTitle: string
        readonly signedOutDescription: string
        readonly unreachableTitle: string
        readonly unreachableDescription: string
        readonly emptyTitle: string
        readonly emptyDescription: string
    }
    /** What the surface reports upward; browse itself is read-only (adds ride the tile control). */
    readonly on: Record<never, never>
}

/**
 * The browse route's whole render. A signed-out visitor gets the gate (the catalog lives behind
 * the session the order service guards); an unreachable service is an error surface; a reachable
 * service with zero rows is a genuine empty state and the duck is welcome there. Ready tiles show
 * the served stock and carry the real add-to-cart control.
 */
export const BrowsePageBase = (props: BrowsePageProps) => {
    if (props.state === "signedOut") {
        return (
            <>
                <SectionHeader title={props.props.title} description={props.props.description} level={1} />
                <StateBlock
                    title={props.props.signedOutTitle}
                    description={props.props.signedOutDescription}
                />
            </>
        )
    }

    if (props.state === "failed") {
        return (
            <>
                <SectionHeader title={props.props.title} description={props.props.description} level={1} />
                <StateBlock
                    title={props.props.unreachableTitle}
                    description={props.props.unreachableDescription}
                />
            </>
        )
    }

    if (props.state === "empty") {
        return (
            <>
                <SectionHeader title={props.props.title} description={props.props.description} level={1} />
                <StateBlock mascot title={props.props.emptyTitle} description={props.props.emptyDescription} />
            </>
        )
    }

    return (
        <>
            <SectionHeader title={props.props.title} description={props.props.description} level={1} />
            <div className={browsePageClassNames.grid}>
                {props.props.products.map((product) => (
                    <CatalogueTile
                        key={product.id}
                        name={product.name}
                        price={formatPrice(product.priceCents, product.currency)}
                        imageUrl={product.imageUrl}
                    >
                        <Text as="p" size="sm" tone="muted">
                            {props.props.stockLabel.replace("{count}", String(product.stock))}
                        </Text>
                        <AddToCartControl
                            productId={product.id}
                            addLabel={props.props.addToCart}
                            addingLabel={props.props.addingToCart}
                            inCartLabel={props.props.inCartLabel}
                            refusedLabel={props.props.addRefused}
                        />
                    </CatalogueTile>
                ))}
            </div>
        </>
    )
}
