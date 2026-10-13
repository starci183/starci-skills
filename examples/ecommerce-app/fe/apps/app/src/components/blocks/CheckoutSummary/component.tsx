import { Button } from "@starci/grammar/common"
import {
    ConfirmOrderPanel,
    GatedHeader,
    LineItemsCard,
    SlotView,
    type ConfirmOrderPanelProps,
    type GateNoticeProps,
    type LineItemRow,
    type Slot,
    type SlotLabels,
} from "@ecommerce/ui"
import { checkoutSummaryClassNames } from "./classNames"

/** The screen situations a checkout read can settle. */
export type CheckoutSummaryState = "signedOut" | "checkout"

/** The checkout's resolved inputs: every string, the summary lines, the confirm control and the hrefs settled. */
export type CheckoutSummaryBaseProps = {
    /** Whole-screen situations this surface settles. */
    readonly state: CheckoutSummaryState
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly title: string
        readonly description: string
        readonly summaryTitle: string
        readonly orderTotal: string
        readonly linesSlot: Slot<ReadonlyArray<LineItemRow>>
        /** The confirm control, resolved: its copy, the answer of the last attempt and the receipt press. */
        readonly confirm: ConfirmOrderPanelProps
        readonly gate: GateNoticeProps | null
        readonly slotLabels: SlotLabels
        readonly browseCta: string
        readonly browseHref: string
    }
}

/**
 * The checkout route's whole render. Ready draws the cart's real lines and total beside the one
 * confirm affordance; the empty state still offers the confirm, because the empty-cart refusal is
 * a real service answer the surface must be able to show. A signed-out visitor gets the gate; an
 * unreachable service is an error surface (no mascot).
 */
export const CheckoutSummaryBase = (props: CheckoutSummaryBaseProps) => {
    const confirm = <ConfirmOrderPanel {...props.props.confirm} />
    return (
        <>
            <GatedHeader title={props.props.title} description={props.props.description} gate={props.props.gate} />
            {props.state === "checkout" ? (
                <SlotView
                    slot={props.props.linesSlot}
                    emptyMascot
                    emptyAction={
                        <div className={checkoutSummaryClassNames.actions}>
                            {confirm}
                            <Button href={props.props.browseHref} variant="secondary" size="sm">
                                {props.props.browseCta}
                            </Button>
                        </div>
                    }
                    labels={props.props.slotLabels}
                >
                    {(lines) => (
                        <>
                            <LineItemsCard
                                label={props.props.summaryTitle}
                                total={props.props.orderTotal}
                                lines={lines}
                            />
                            <div className={checkoutSummaryClassNames.actions}>{confirm}</div>
                        </>
                    )}
                </SlotView>
            ) : null}
        </>
    )
}
