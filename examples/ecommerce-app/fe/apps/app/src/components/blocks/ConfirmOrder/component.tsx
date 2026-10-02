import { Button, SurfaceCard, Text } from "@starci/grammar/common"
import type { Outcome } from "@ecommerce/api"
import type { ReceiptFailure } from "../../../hooks/cart"
import type { OrderConfirmation } from "../../../modules/types"

/** Resolved checkout copy and the answer of one confirmation attempt. */
export type ConfirmOrderBaseProps = {
    readonly props: {
        readonly attemptKey: string
        readonly productNames: Readonly<Record<string, string>>
        readonly confirmLabel: string
        readonly confirmingLabel: string
        readonly confirmedTitle: string
        readonly confirmedDetail: string
        readonly replayedNote: string
        readonly receiptLabel: string
        readonly receiptPendingLabel: string
        readonly receiptNotReady: string
        readonly receiptRefused: string
        readonly accountCta: string
        readonly accountHref: string
        readonly refusedCartEmpty: string
        readonly refusedStock: string
        readonly refusedUnknownProduct: string
        readonly refusedSession: string
        readonly refusedGeneric: string
        /** The answer of the last attempt, `null` before the first press. */
        readonly outcome: Outcome<OrderConfirmation> | null
        /** The confirmed order's total, formatted in the reader's language. */
        readonly confirmedTotal: string
        readonly pending: boolean
        /** Why the last receipt press did not download, `null` before a press or after a download. */
        readonly receiptFailure: ReceiptFailure
        readonly receiptPending: boolean
    }
    readonly on: {
        readonly onPress: () => void
        /** Downloads the receipt of the confirmed order. */
        readonly onReceipt: () => void
    }
}

const interpolate = (template: string, values: Record<string, string>): string =>
    Object.entries(values).reduce((line, [key, value]) => line.replaceAll(`{${key}}`, value), template)

/** The text of one detail of a named refusal, or `""` when the service sent none. */
const detailText = (details: Readonly<Record<string, unknown>> | undefined, key: string): string => {
    const value = details?.[key]
    return typeof value === "string" || typeof value === "number" ? String(value) : ""
}

/** Turn the service's refusal into the line that names what it refused and why; the stable code picks the copy. */
const refusalLine = (
    outcome: Exclude<Outcome<OrderConfirmation>, { readonly kind: "ok" }>,
    props: ConfirmOrderBaseProps["props"],
): string => {
    if (outcome.kind === "refused") return props.refusedSession
    const productId = outcome.kind === "invalid" ? detailText(outcome.details, "productId") : ""
    if (outcome.kind === "invalid" && outcome.code === "ORDER_CART_EMPTY") return props.refusedCartEmpty
    if (outcome.kind === "invalid" && outcome.code === "ORDER_INSUFFICIENT_STOCK") {
        return interpolate(props.refusedStock, {
            product: props.productNames[productId] ?? productId,
            requested: detailText(outcome.details, "requested"),
            available: detailText(outcome.details, "available"),
        })
    }
    if (outcome.kind === "invalid" && outcome.code === "ORDER_UNKNOWN_PRODUCT") {
        return interpolate(props.refusedUnknownProduct, { productId })
    }
    return interpolate(props.refusedGeneric, {
        code: outcome.kind === "invalid" ? (outcome.code ?? "REFUSED") : outcome.kind,
    })
}

/** The line that names why the last receipt press did not download, or `null`. */
const receiptFailureLine = (props: ConfirmOrderBaseProps["props"]): string | null => {
    if (props.receiptFailure === "notReady") return props.receiptNotReady
    return props.receiptFailure === "refused" ? props.receiptRefused : null
}

/**
 * Draws the service's confirmation or refusal and keeps the confirm button available for replay. A confirmed order offers
 * its receipt download beside the way to the account.
 */
export const ConfirmOrderBase = (props: ConfirmOrderBaseProps) => {
    const values = props.props
    const confirmed = values.outcome?.kind === "ok" ? values.outcome.data : null
    const refusal = values.outcome !== null && values.outcome.kind !== "ok" ? refusalLine(values.outcome, values) : null
    const receiptFailure = receiptFailureLine(values)
    return (
        <>
            {confirmed ? (
                <SurfaceCard label={values.confirmedTitle}>
                    <Text as="p" size="sm">
                        {interpolate(values.confirmedDetail, {
                            orderId: confirmed.orderId,
                            status: confirmed.status,
                            total: values.confirmedTotal,
                        })}
                    </Text>
                    {confirmed.replayed ? (
                        <Text as="p" size="sm" tone="muted">
                            {values.replayedNote}
                        </Text>
                    ) : null}
                    <Button
                        variant="secondary"
                        size="sm"
                        onPress={props.on.onReceipt}
                        isPending={values.receiptPending}
                        isDisabled={values.receiptPending}
                    >
                        {values.receiptPending ? values.receiptPendingLabel : values.receiptLabel}
                    </Button>
                    {receiptFailure ? (
                        <Text as="p" size="sm" live="polite">
                            {receiptFailure}
                        </Text>
                    ) : null}
                    <Button href={values.accountHref} variant="secondary" size="sm">
                        {values.accountCta}
                    </Button>
                </SurfaceCard>
            ) : null}
            <Button
                variant="primary"
                size="sm"
                onPress={props.on.onPress}
                isPending={values.pending}
                isDisabled={values.pending}
            >
                {values.pending ? values.confirmingLabel : values.confirmLabel}
            </Button>
            {refusal ? (
                <Text as="p" size="sm" live="assertive">
                    {refusal}
                </Text>
            ) : null}
        </>
    )
}
