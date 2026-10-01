import { Button } from "@starci/grammar/common"
import {
    GatedHeader,
    LineItemsCard,
    SlotView,
    type GateNoticeProps,
    type LineItemRow,
    type Slot,
    type SlotLabels,
} from "@ecommerce/ui"
import { checkoutPageClassNames } from "./classNames"
import { ConfirmOrder } from "../../../components/blocks/ConfirmOrder"

/** The screen situations a checkout read can settle. */
export type CheckoutPageState = "signedOut" | "checkout"

/** The checkout page's resolved inputs: every string, the summary lines, the attempt key and the hrefs settled. */
export type CheckoutPageProps = {
    /** Whole-screen situations this surface settles. */
    readonly state: CheckoutPageState
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly title: string
        readonly description: string
        readonly summaryTitle: string
        readonly orderTotal: string
        readonly linesSlot: Slot<ReadonlyArray<LineItemRow>>
        /** The idempotency key this render's confirmation carries ("" when nobody could confirm). */
        readonly attemptKey: string
        readonly productNames: Readonly<Record<string, string>>
        readonly confirmLabel: string
        readonly confirmingLabel: string
        readonly confirmedTitle: string
        readonly confirmedDetail: string
        readonly replayedNote: string
        readonly refusedCartEmpty: string
        readonly refusedStock: string
        readonly refusedUnknownProduct: string
        readonly refusedSession: string
        readonly refusedGeneric: string
        readonly gate: GateNoticeProps | null
        readonly slotLabels: SlotLabels
        readonly browseCta: string
        readonly accountCta: string
        readonly browseHref: string
        readonly accountHref: string
    }
    /** What the surface reports upward; the confirmation rides the confirm control. */
    readonly on: Record<never, never>
}

/**
 * The checkout route's whole render. Ready draws the cart's real lines and total beside the one
 * confirm affordance; the empty state still offers the confirm, because the empty-cart refusal is
 * a real service answer the surface must be able to show. A signed-out visitor gets the gate; an
 * unreachable service is an error surface (no mascot).
 */
export const CheckoutPageBase = (props: CheckoutPageProps) => {
    const confirm = (
        <ConfirmOrder
            attemptKey={props.props.attemptKey}
            productNames={props.props.productNames}
            confirmLabel={props.props.confirmLabel}
            confirmingLabel={props.props.confirmingLabel}
            confirmedTitle={props.props.confirmedTitle}
            confirmedDetail={props.props.confirmedDetail}
            replayedNote={props.props.replayedNote}
            accountCta={props.props.accountCta}
            accountHref={props.props.accountHref}
            refusedCartEmpty={props.props.refusedCartEmpty}
            refusedStock={props.props.refusedStock}
            refusedUnknownProduct={props.props.refusedUnknownProduct}
            refusedSession={props.props.refusedSession}
            refusedGeneric={props.props.refusedGeneric}
        />
    )
    return (
        <>
            <GatedHeader title={props.props.title} description={props.props.description} gate={props.props.gate} />
            {props.state === "checkout" ? (
                <SlotView
                    slot={props.props.linesSlot}
                    emptyMascot
                    emptyAction={
                        <div className={checkoutPageClassNames.actions}>
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
                            <div className={checkoutPageClassNames.actions}>{confirm}</div>
                        </>
                    )}
                </SlotView>
            ) : null}
        </>
    )
}
