import { Button, SectionHeader, Text } from "@starci/grammar/common"
import { CatalogueTile, StateBlock, SlotView, type Slot } from "@ecommerce/ui"
import { browseCatalogueClassNames } from "./classNames"

/** The screen situations a catalogue read can settle. */
export type BrowseCatalogueState = "signedOut" | "browse"

/** One product as the browse grid draws it: its price already formatted in the reader's language. */
export type BrowseProduct = {
    readonly id: string
    readonly name: string
    readonly price: string
    readonly stock: number
    readonly imageUrl?: string
}

/** The browse page's resolved inputs: every string and the product payload already settled. */
export type BrowseCatalogueBaseProps = {
    /** Whole-screen situations this surface settles. */
    readonly state: BrowseCatalogueState
    /** The data payload for whatever state is showing. */
    readonly props: {
        /** What the products slot announces while the catalogue is read. */
        readonly loadingLabel: string
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
        /** The quantity in the cart each product's last add answered, by product id. */
        readonly quantities: Readonly<Record<string, number>>
        /** The products whose last add the order service refused. */
        readonly refusedIds: ReadonlyArray<string>
        /** The product whose add is running, if any. */
        readonly pendingId: string | null
    }
    /** What the surface reports upward: one press of a product's add control. */
    readonly on: { readonly onAdd: (productId: string) => void }
}

/**
 * The browse route's whole render. A signed-out visitor gets the gate (the catalog lives behind
 * the session the order service guards); an unreachable service is an error surface; a reachable
 * service with zero rows is a genuine empty state and the duck is welcome there. Ready tiles show
 * the served stock and carry the real add-to-cart control.
 */
export const BrowseCatalogueBase = (props: BrowseCatalogueBaseProps) => {
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
                    loadingLabel: props.props.loadingLabel,
                    emptyTitle: props.props.emptyTitle,
                    emptyDescription: props.props.emptyDescription,
                    errorTitle: props.props.unreachableTitle,
                    errorDescription: props.props.unreachableDescription,
                }}
            >
                {(products) => (
                    <div className={browseCatalogueClassNames.grid}>
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
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onPress={() => props.on.onAdd(product.id)}
                                    isPending={props.props.pendingId === product.id}
                                    isDisabled={props.props.pendingId === product.id}
                                >
                                    {props.props.pendingId === product.id
                                        ? props.props.addingToCart
                                        : props.props.addToCart}
                                </Button>
                                {(props.props.quantities[product.id] ?? 0) > 0 ? (
                                    <Text as="p" size="sm" tone="muted">
                                        {props.props.inCartLabel.replace(
                                            "{count}",
                                            String(props.props.quantities[product.id]),
                                        )}
                                    </Text>
                                ) : null}
                                {props.props.refusedIds.includes(product.id) ? (
                                    <Text as="p" size="sm" live="assertive">
                                        {props.props.addRefused}
                                    </Text>
                                ) : null}
                            </CatalogueTile>
                        ))}
                    </div>
                )}
            </SlotView>
        </>
    )
}
