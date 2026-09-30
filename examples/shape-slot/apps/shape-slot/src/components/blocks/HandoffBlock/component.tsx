import { Button, SurfaceCard, Text } from "@starci/grammar/common"
import { OrderDisclosure } from "@/components/branches/OrderDisclosure"
import { OrderSummary } from "@/components/composites/OrderSummary"
import { SlotView } from "@/components/composites/SlotView"
import { StatusChip } from "@/components/leaves/StatusChip"
import type { Handoff, HandoffStatus, Order, SendInput, Slot, SlotLabels } from "@/modules/types"
import {
    handoffBlockActionsClassName,
    handoffBlockBodyClassName,
    handoffBlockHeaderClassName,
} from "./classNames"

/** Shape used while the handoff slot is still loading, so the skeleton has a tree to follow. */
export const handoffBlockDefaultState: HandoffStatus = "prepared"

/** Localized copy resolved by the connected half. */
export type HandoffBlockLabels = {
    readonly title: string
    readonly prepared: string
    readonly sent: string
    readonly returned: string
    readonly send: string
    readonly resend: string
    readonly fingerprint: string
    readonly revision: string
    readonly receipt: string
    readonly reason: string
    readonly customer: string
    readonly amount: string
    readonly lines: string
    readonly orderSlot: SlotLabels
    readonly handoffSlot: SlotLabels
}

/** Atoms only: two independent slots (one per api) and the labels. */
export type HandoffBlockData = {
    readonly order: Slot<Order>
    readonly handoff: Slot<Handoff>
    readonly labels: HandoffBlockLabels
}

/** Actions the pure half emits; every argument is an atom. */
export type HandoffBlockActions = {
    readonly requestSend: (input: SendInput) => void
    readonly retryOrder: () => void
    readonly retryHandoff: () => void
}

/** Complete input of HandoffBlockBase. */
export type HandoffBlockBaseProps = {
    readonly state: HandoffStatus
    readonly props: HandoffBlockData
    readonly on: HandoffBlockActions
}

const orderPlaceholder: Order = { code: "SO-0000-000", customer: "Sample customer", amount: 0, lines: [{ sku: "SKU", qty: 1 }] }
const handoffPlaceholder: Handoff = { status: "prepared", fingerprint: "fp-0000", revision: 0 }

/** Pure half: draws one of three shapes; each slot renders its own status through SlotView. */
export const HandoffBlockBase = (props: HandoffBlockBaseProps) => {
    const { labels } = props.props
    const order = (
        <SlotView slot={props.props.order} placeholder={orderPlaceholder} labels={labels.orderSlot} onRetry={props.on.retryOrder}>
            {(value, isSkeleton) => (
                <>
                    <OrderSummary
                        customer={value.customer}
                        code={value.code}
                        amount={value.amount}
                        customerTerm={labels.customer}
                        amountTerm={labels.amount}
                        isSkeleton={isSkeleton}
                    />
                    {isSkeleton ? null : <OrderDisclosure lines={value.lines} title={`${value.lines.length} ${labels.lines}`} />}
                </>
            )}
        </SlotView>
    )
    const send = (value: Handoff, label: string) => (
        <Button variant="primary" onPress={() => props.on.requestSend({ fingerprint: value.fingerprint, revision: value.revision })}>
            {label}
        </Button>
    )

    return (
        <SurfaceCard label={labels.title}>
            <div className={handoffBlockBodyClassName}>
                {props.state === "prepared" ? (
                    <>
                        <div className={handoffBlockHeaderClassName}><StatusChip label={labels.prepared} tone="neutral" /></div>
                        {order}
                        <SlotView slot={props.props.handoff} placeholder={handoffPlaceholder} labels={labels.handoffSlot} onRetry={props.on.retryHandoff}>
                            {(value, isSkeleton) => (
                                <div className={handoffBlockActionsClassName}>
                                    <Text isSkeleton={isSkeleton}>{labels.fingerprint} {value.fingerprint} · {labels.revision} {value.revision}</Text>
                                    {send(value, labels.send)}
                                </div>
                            )}
                        </SlotView>
                    </>
                ) : null}

                {props.state === "sent" ? (
                    <>
                        <div className={handoffBlockHeaderClassName}><StatusChip label={labels.sent} tone="success" /></div>
                        {order}
                        <SlotView slot={props.props.handoff} placeholder={handoffPlaceholder} labels={labels.handoffSlot} onRetry={props.on.retryHandoff}>
                            {(value, isSkeleton) => <Text isSkeleton={isSkeleton}>{labels.receipt} {value.receiptId}</Text>}
                        </SlotView>
                    </>
                ) : null}

                {props.state === "returned" ? (
                    <>
                        <div className={handoffBlockHeaderClassName}><StatusChip label={labels.returned} tone="danger" /></div>
                        <SlotView slot={props.props.handoff} placeholder={handoffPlaceholder} labels={labels.handoffSlot} onRetry={props.on.retryHandoff}>
                            {(value, isSkeleton) => (
                                <div className={handoffBlockActionsClassName}>
                                    <Text isSkeleton={isSkeleton}>{labels.reason}: {value.reason}</Text>
                                    {send(value, labels.resend)}
                                </div>
                            )}
                        </SlotView>
                        {order}
                    </>
                ) : null}
            </div>
        </SurfaceCard>
    )
}
