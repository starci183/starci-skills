import { SectionHeader, Text } from "@starci/grammar/common"
import { CatalogueTile, StateBlock, SlotView, type Slot } from "@ecommerce/ui"
import { browsePageClassNames } from "./classNames"
import { AddToCartControl } from "../../../components/blocks/AddToCart"

/** The screen situations a catalogue read can settle. */
export type BrowsePageState = "signedOut" | "browse"

/** One product as the browse grid draws it: its price already formatted in the reader's language. */
export type BrowseProduct = {
    readonly id: string
    readonly name: string
    readonly price: string
    readonly stock: number
    readonly imageUrl?: string
}

/** The browse page's resolved inputs: every string and the product payload already settled. */
export type BrowsePageProps = {
    /** Whole-screen situations this surface settles. */
    readonly state: BrowsePageState
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly title: string
        readonly description: string
        readonly productsSlot: Slot<ReadonlyArray<BrowseProduct>>
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
                <StateBlock title={props.props.signedOutTitle} description={props.props.signedOutDescription} />
            </>
        )
    }

    return (
        <>
            <SectionHeader title={props.props.title} description={props.props.description} level={1} />
            <SlotView
                slot={props.props.productsSlot}
                emptyMascot
                labels={{
                    emptyTitle: props.props.emptyTitle,
                    emptyDescription: props.props.emptyDescription,
                    errorTitle: props.props.unreachableTitle,
                    errorDescription: props.props.unreachableDescription,
                }}
            >
                {(products) => (
                    <div className={browsePageClassNames.grid}>
                        {products.map((product) => (
                            <CatalogueTile
                                key={product.id}
                                name={product.name}
                                price={product.price}
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
                )}
            </SlotView>
        </>
    )
}
