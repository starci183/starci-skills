"use client"

import { Button, SectionHeader, SurfaceListCard, Text } from "@starci/grammar/common"
import { StateBlock } from "@ecommerce/shared/components/leaves/StateBlock"
import { cartPageClassNames } from "./classNames"
import { ClearCartControl } from "../../../components/blocks/ClearCart"
import { SlotView } from "@ecommerce/shared/components/composites/SlotView"
import type { Slot } from "@ecommerce/shared/modules/slot"

/** The screen situations a cart read can settle. */
export type CartPageState = "signedOut" | "cart"

/** One cart line with every rendered string already resolved (name, quantity, line total). */
export type CartLineRow = {
    readonly productId: string
    readonly name: string
    readonly quantityLabel: string
    readonly lineTotal: string
}

/** The cart page's resolved inputs: every string, the line payloads and both hrefs settled. */
export type CartPageProps = {
    /** Whole-screen situations this surface settles. */
    readonly state: CartPageState
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly title: string
        readonly description: string
        readonly linesTitle: string
        readonly cartTotal: string
        readonly linesSlot: Slot<ReadonlyArray<CartLineRow>>
        readonly clearLabel: string
        readonly clearingLabel: string
        readonly clearRefused: string
        readonly checkoutCta: string
        readonly checkoutHref: string
        readonly emptyTitle: string
        readonly emptyDescription: string
        readonly backToBrowse: string
        readonly browseHref: string
        readonly accountCta: string
        readonly accountHref: string
        readonly signedOutTitle: string
        readonly signedOutDescription: string
        readonly unreachableTitle: string
        readonly unreachableDescription: string
    }
    /** What the surface reports upward; the cart's write rides the clear control. */
    readonly on: Record<never, never>
}

/**
 * The cart route's whole render: the person's real server-side cart. Lines come from the order
 * service joined with its catalog snapshot; a signed-out visitor gets the gate; an unreachable
 * service is an error surface (no mascot); a genuinely empty cart is the one place the duck joins.
 */
export const CartPageBase = (props: CartPageProps) => (
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
        {props.state === "cart" ? (
            <SlotView
                slot={props.props.linesSlot}
                emptyMascot
                emptyAction={<Button href={props.props.browseHref} variant="secondary" size="sm">{props.props.backToBrowse}</Button>}
                labels={{
                    emptyTitle: props.props.emptyTitle,
                    emptyDescription: props.props.emptyDescription,
                    errorTitle: props.props.unreachableTitle,
                    errorDescription: props.props.unreachableDescription,
                }}
            >
                {(lines) => (
                    <>
                        <SurfaceListCard label={props.props.linesTitle} fact={props.props.cartTotal}>
                            {lines.map((line) => (
                                <li className={cartPageClassNames.row} key={line.productId}>
                                    <span>
                                        <Text as="span" weight="semibold">
                                            {line.name}
                                        </Text>{" "}
                                        <Text as="span" size="sm" tone="muted">
                                            {line.quantityLabel}
                                        </Text>
                                    </span>
                                    <span className={cartPageClassNames.rowAside}>
                                        <Text as="span" weight="semibold">
                                            {line.lineTotal}
                                        </Text>
                                    </span>
                                </li>
                            ))}
                        </SurfaceListCard>
                        <div className={cartPageClassNames.actions}>
                            <ClearCartControl
                                clearLabel={props.props.clearLabel}
                                clearingLabel={props.props.clearingLabel}
                                refusedLabel={props.props.clearRefused}
                            />
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
