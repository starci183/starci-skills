"use client"

import { Button, SectionHeader, SurfaceListCard, Text } from "@starci/grammar/common"
import { StateBlock } from "@shared/leaves/StateBlock"
import { checkoutPageClassNames } from "./classNames"
import { ConfirmOrderControl } from "../../blocks/ConfirmOrder"

/** The screen situations a checkout read can settle. */
export type CheckoutPageState = "signedOut" | "failed" | "empty" | "ready"

/** One checkout summary line with every rendered string already resolved. */
export type CheckoutLineRow = {
    readonly productId: string
    readonly name: string
    readonly quantityLabel: string
    readonly lineTotal: string
}

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
        readonly lines: ReadonlyArray<CheckoutLineRow>
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
        readonly emptyTitle: string
        readonly emptyDescription: string
        readonly signedOutTitle: string
        readonly signedOutDescription: string
        readonly unreachableTitle: string
        readonly unreachableDescription: string
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
        <ConfirmOrderControl
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
            <SectionHeader title={props.props.title} description={props.props.description} level={1} />
            {props.state === "signedOut" ? (
                <StateBlock
                    title={props.props.signedOutTitle}
                    description={props.props.signedOutDescription}
                >
                    <Button href={props.props.accountHref} variant="secondary" size="sm">
                        {props.props.accountCta}
                    </Button>
                </StateBlock>
            ) : null}
            {props.state === "failed" ? (
                <StateBlock
                    title={props.props.unreachableTitle}
                    description={props.props.unreachableDescription}
                />
            ) : null}
            {props.state === "empty" ? (
                <StateBlock mascot title={props.props.emptyTitle} description={props.props.emptyDescription}>
                    <div className={checkoutPageClassNames.actions}>
                        {confirm}
                        <Button href={props.props.browseHref} variant="secondary" size="sm">
                            {props.props.browseCta}
                        </Button>
                    </div>
                </StateBlock>
            ) : null}
            {props.state === "ready" ? (
                <>
                    <SurfaceListCard label={props.props.summaryTitle} fact={props.props.orderTotal}>
                        {props.props.lines.map((line) => (
                            <li className={checkoutPageClassNames.row} key={line.productId}>
                                <span>
                                    <Text as="span" weight="semibold">
                                        {line.name}
                                    </Text>{" "}
                                    <Text as="span" size="sm" tone="muted">
                                        {line.quantityLabel}
                                    </Text>
                                </span>
                                <span className={checkoutPageClassNames.rowAside}>
                                    <Text as="span" weight="semibold">
                                        {line.lineTotal}
                                    </Text>
                                </span>
                            </li>
                        ))}
                    </SurfaceListCard>
                    <div className={checkoutPageClassNames.actions}>
                        {confirm}
                    </div>
                </>
            ) : null}
        </>
    )
}
