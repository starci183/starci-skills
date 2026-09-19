"use client"

import { useState } from "react"
import { Button, SurfaceCard, Text } from "@starci/grammar/common"
import { formatPrice } from "../../../modules/money"
import { placeOrderAction } from "./actions"
import type { PlaceOrderOutcome } from "../../../modules/api/orders"

/** The confirm control's resolved inputs: the attempt's key, the product names it can show, and every string it can render. */
export type ConfirmOrderControlProps = {
    /**
     * The idempotency key this rendered checkout carries - a nonce minted at render time. Pressing
     * confirm again on the same render sends the same key, so the service replays the first
     * confirmation instead of writing a second order; a fresh render mints a new key and is a
     * genuinely new attempt.
     */
    readonly attemptKey: string
    /** Catalog names by product id, so a stock refusal can name the product, not just its id. */
    readonly productNames: Readonly<Record<string, string>>
    readonly confirmLabel: string
    readonly confirmingLabel: string
    readonly confirmedTitle: string
    /** The confirmation line, with `{orderId}`, `{status}`, `{total}` and `{paymentId}` slots. */
    readonly confirmedDetail: string
    readonly replayedNote: string
    readonly accountCta: string
    readonly accountHref: string
    readonly refusedCartEmpty: string
    /** The stock refusal line, with `{product}`, `{requested}` and `{available}` slots. */
    readonly refusedStock: string
    /** The unknown-product refusal line, with `{productId}` slot. */
    readonly refusedUnknownProduct: string
    readonly refusedSession: string
    /** The generic refusal line, with `{reason}` slot. */
    readonly refusedGeneric: string
}

type Outcome = PlaceOrderOutcome | null

const interpolate = (template: string, values: Record<string, string>): string =>
    Object.entries(values).reduce(
        (line, [key, value]) => line.replaceAll(`{${key}}`, value),
        template)

/**
 * The checkout's confirm affordance and the surface its answer renders on. One press sends the
 * rendered attempt's idempotency key; the service's answer is drawn verbatim - the confirmation
 * (replays marked as replays), or the named refusal naming the product, the asked quantity and the
 * stock there actually was. The button stays mounted beside a confirmation on purpose: a second
 * press of the same render re-sends the same key, and the service's replay is the honest answer to
 * "send the same confirmation again" - a refused cart is drawn unchanged, because the service
 * changed nothing.
 */
export const ConfirmOrderControl = (props: ConfirmOrderControlProps) => {
    const [outcome, setOutcome] = useState<Outcome>(null)
    const [pending, setPending] = useState(false)
    const onPress = () => {
        setPending(true)
        void placeOrderAction(props.attemptKey).then((answer) => {
            setOutcome(answer)
            setPending(false)
        })
    }

    const confirmed = outcome?.kind === "confirmed" ? outcome.confirmation : null
    const refusal = outcome && outcome.kind !== "confirmed" ? refusalLine(outcome, props) : null
    return (
        <>
            {confirmed ? (
                <SurfaceCard label={props.confirmedTitle}>
                    <Text as="p" size="sm">
                        {interpolate(props.confirmedDetail, {
                            orderId: confirmed.orderId,
                            status: confirmed.status,
                            total: formatPrice(confirmed.totalMinorUnits, confirmed.currency),
                            paymentId: confirmed.paymentId,
                        })}
                    </Text>
                    {confirmed.replayed ? (
                        <Text as="p" size="sm" tone="muted">
                            {props.replayedNote}
                        </Text>
                    ) : null}
                    <Button href={props.accountHref} variant="secondary" size="sm">
                        {props.accountCta}
                    </Button>
                </SurfaceCard>
            ) : null}
            <Button
                variant="primary"
                size="sm"
                onPress={onPress}
                isPending={pending}
                isDisabled={pending}
            >
                {pending ? props.confirmingLabel : props.confirmLabel}
            </Button>
            {refusal ? (
                <Text as="p" size="sm" live="assertive">
                    {refusal}
                </Text>
            ) : null}
        </>
    )
}

/** Turn the service's answer into the refusal line that names what it refused and why. */
const refusalLine = (
    outcome: Exclude<PlaceOrderOutcome, { readonly kind: "confirmed" }>,
    props: ConfirmOrderControlProps,
): string => {
    if (outcome.kind === "refused") {
        if (outcome.reason === "cart-empty") {
            return props.refusedCartEmpty
        }
        if (outcome.reason === "insufficient-stock") {
            return interpolate(props.refusedStock, {
                product: props.productNames[outcome.productId] ?? outcome.productId,
                requested: String(outcome.requested ?? ""),
                available: String(outcome.available ?? ""),
            })
        }
        if (outcome.reason === "unknown-product") {
            return interpolate(props.refusedUnknownProduct, { productId: outcome.productId })
        }
        return interpolate(props.refusedGeneric, { reason: outcome.reason })
    }
    if (outcome.code === "SESSION_INVALID") {
        return props.refusedSession
    }
    return interpolate(props.refusedGeneric, { reason: outcome.reason })
}
