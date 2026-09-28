"use client"

import { Button, SurfaceCard, Text } from "@starci/grammar/common"
import { formatPrice } from "../../../modules/money"
import type { PlaceOrderOutcome } from "../../../modules/api/orders"

/** Resolved checkout copy and the answer of one confirmation attempt. */
export type ConfirmOrderControlBaseProps = {
    readonly state: "ready"
    readonly props: {
        readonly attemptKey: string
        readonly productNames: Readonly<Record<string, string>>
        readonly confirmLabel: string
        readonly confirmingLabel: string
        readonly confirmedTitle: string
        readonly confirmedDetail: string
        readonly replayedNote: string
        readonly accountCta: string
        readonly accountHref: string
        readonly refusedCartEmpty: string
        readonly refusedStock: string
        readonly refusedUnknownProduct: string
        readonly refusedSession: string
        readonly refusedGeneric: string
        readonly outcome: PlaceOrderOutcome | null
        readonly pending: boolean
    }
    readonly on: { readonly onPress: () => void }
}

const interpolate = (template: string, values: Record<string, string>): string =>
    Object.entries(values).reduce((line, [key, value]) => line.replaceAll(`{${key}}`, value), template)

/** Draws the service's confirmation or refusal and keeps the confirm button available for replay. */
export const ConfirmOrderControlBase = (props: ConfirmOrderControlBaseProps) => {
    const values = props.props
    const confirmed = values.outcome?.kind === "confirmed" ? values.outcome.confirmation : null
    const refusal = values.outcome && values.outcome.kind !== "confirmed" ? refusalLine(values.outcome, values) : null
    return (
        <>
            {confirmed ? (
                <SurfaceCard label={values.confirmedTitle}>
                    <Text as="p" size="sm">
                        {interpolate(values.confirmedDetail, {
                            orderId: confirmed.orderId,
                            status: confirmed.status,
                            total: formatPrice(confirmed.totalMinorUnits, confirmed.currency),
                            paymentId: confirmed.paymentId,
                        })}
                    </Text>
                    {confirmed.replayed ? <Text as="p" size="sm" tone="muted">{values.replayedNote}</Text> : null}
                    <Button href={values.accountHref} variant="secondary" size="sm">{values.accountCta}</Button>
                </SurfaceCard>
            ) : null}
            <Button variant="primary" size="sm" onPress={props.on.onPress} isPending={values.pending} isDisabled={values.pending}>
                {values.pending ? values.confirmingLabel : values.confirmLabel}
            </Button>
            {refusal ? <Text as="p" size="sm" live="assertive">{refusal}</Text> : null}
        </>
    )
}

/** Turn the service answer into the refusal line that names what it refused and why. */
const refusalLine = (
    outcome: Exclude<PlaceOrderOutcome, { readonly kind: "confirmed" }>,
    props: ConfirmOrderControlBaseProps["props"],
): string => {
    if (outcome.kind === "refused") {
        if (outcome.reason === "cart-empty") return props.refusedCartEmpty
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
    if (outcome.code === "SESSION_INVALID") return props.refusedSession
    return interpolate(props.refusedGeneric, { reason: outcome.reason })
}
