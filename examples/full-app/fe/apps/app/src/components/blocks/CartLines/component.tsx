import { Button, Text } from "@starci/grammar/common"
import {
    GatedHeader,
    LineItemsCard,
    SlotView,
    type GateNoticeProps,
    type LineItemRow,
    type Slot,
    type SlotLabels,
} from "@ecommerce/ui"
import { cartLinesClassNames } from "./classNames"

/** The screen situations a cart read can settle. */
export type CartLinesState = "signedOut" | "cart"

/** The cart page's resolved inputs: every string, the line payloads and both hrefs settled. */
export type CartLinesBaseProps = {
    /** Whole-screen situations this surface settles. */
    readonly state: CartLinesState
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly title: string
        readonly description: string
        readonly linesTitle: string
        readonly cartTotal: string
        readonly linesSlot: Slot<ReadonlyArray<LineItemRow>>
        readonly clearLabel: string
        readonly clearingLabel: string
        readonly clearRefused: string
        readonly checkoutCta: string
        readonly checkoutHref: string
        readonly backToBrowse: string
        readonly browseHref: string
        readonly gate: GateNoticeProps | null
        readonly slotLabels: SlotLabels
        /** The order service refused the last clear. */
        readonly clearRefusedShown: boolean
        readonly clearPending: boolean
    }
    /** What the surface reports upward: the clear press. */
    readonly on: { readonly onClear: () => void }
}

/**
 * The cart route's whole render: the person's real server-side cart. Lines come from the order
 * service joined with its catalog snapshot; a signed-out visitor gets the gate; an unreachable
 * service is an error surface (no mascot); a genuinely empty cart is the one place the duck joins.
 */
export const CartLinesBase = (props: CartLinesBaseProps) => (
    <>
        <GatedHeader title={props.props.title} description={props.props.description} gate={props.props.gate} />
        {props.state === "cart" ? (
            <SlotView
                slot={props.props.linesSlot}
                emptyMascot
                emptyAction={
                    <Button href={props.props.browseHref} variant="secondary" size="sm">
                        {props.props.backToBrowse}
                    </Button>
                }
                labels={props.props.slotLabels}
            >
                {(lines) => (
                    <>
                        <LineItemsCard label={props.props.linesTitle} total={props.props.cartTotal} lines={lines} />
                        <div className={cartLinesClassNames.actions}>
                            <Button
                                variant="secondary"
                                size="sm"
                                onPress={props.on.onClear}
                                isPending={props.props.clearPending}
                                isDisabled={props.props.clearPending}
                            >
                                {props.props.clearPending ? props.props.clearingLabel : props.props.clearLabel}
                            </Button>
                            {props.props.clearRefusedShown ? (
                                <Text as="span" size="sm" live="assertive">
                                    {props.props.clearRefused}
                                </Text>
                            ) : null}
                            <Button href={props.props.checkoutHref} variant="primary" size="sm">
                                {props.props.checkoutCta}
                            </Button>
                        </div>
                    </>
                )}
            </SlotView>
        ) : null}
    </>
)
