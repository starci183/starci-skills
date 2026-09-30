import { Button, SurfaceCard, Text } from "@starci/grammar/common"
import type { Outcome } from "@ecommerce/api"
import type { OrderConfirmation } from "../../../modules/types"

/** Resolved checkout copy and the answer of one confirmation attempt. */
export type ConfirmOrderBaseProps = {
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
        /** The answer of the last attempt, `null` before the first press. */
        readonly outcome: Outcome<OrderConfirmation> | null
        /** The confirmed order's total, formatted in the reader's language. */
        readonly confirmedTotal: string
        readonly pending: boolean
    }
    readonly on: { readonly onPress: () => void }
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
    if (outcome.kind === "invalid" && outcome.code === "CHECKOUT_REFUSAL") {
        const reason = detailText(outcome.details, "reason")
        const productId = detailText(outcome.details, "productId")
        if (reason === "cart-empty") return props.refusedCartEmpty
        if (reason === "insufficient-stock") {
            return interpolate(props.refusedStock, {
                product: props.productNames[productId] ?? productId,
                requested: detailText(outcome.details, "requested"),
                available: detailText(outcome.details, "available"),
            })
        }
        if (reason === "unknown-product") return interpolate(props.refusedUnknownProduct, { productId })
        return interpolate(props.refusedGeneric, { code: "CHECKOUT_REFUSAL" })
    }
    return interpolate(props.refusedGeneric, {
        code: outcome.kind === "invalid" ? (outcome.code ?? "REFUSED") : outcome.kind,
    })
}

/** Draws the service's confirmation or refusal and keeps the confirm button available for replay. */
export const ConfirmOrderBase = (props: ConfirmOrderBaseProps) => {
    const values = props.props
    const confirmed = values.outcome?.kind === "ok" ? values.outcome.data : null
    const refusal = values.outcome !== null && values.outcome.kind !== "ok" ? refusalLine(values.outcome, values) : null
    return (
        <>
            {confirmed ? (
                <SurfaceCard label={values.confirmedTitle}>
                    <Text as="p" size="sm">
                        {interpolate(values.confirmedDetail, {
                            orderId: confirmed.orderId,
                            status: confirmed.status,
                            total: values.confirmedTotal,
                            paymentId: confirmed.paymentId,
                        })}
                    </Text>
                    {confirmed.replayed ? (
                        <Text as="p" size="sm" tone="muted">
                            {values.replayedNote}
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
