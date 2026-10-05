import { Button, SurfaceCard, Text } from "@starci/grammar/common"
import { OrderDisclosure } from "@/components/branches/OrderDisclosure"
import { OrderSummary } from "@/components/composites/OrderSummary"
import {
    SendHandoffForm,
    type SendHandoffFormData,
    type SendHandoffFormState,
} from "@/components/composites/SendHandoffForm"
import { SlotView } from "@/components/composites/SlotView"
import { StatusChip } from "@/components/leaves/StatusChip"
import type { Handoff, HandoffStatus, OrderView, SendInput, Slot, SlotLabels } from "@/modules/types"
import { handoffBlockActionsClassName, handoffBlockBodyClassName, handoffBlockHeaderClassName } from "./classNames"

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

/** The send overlay as atoms: the composite's data plus its drawn shape. */
export type HandoffBlockSend = SendHandoffFormData & { readonly shape: SendHandoffFormState }

/** Atoms only: two independent slots (one per api), the labels, and the overlay's resolved input. */
export type HandoffBlockData = {
    readonly order: Slot<OrderView>
    readonly handoff: Slot<Handoff>
    readonly labels: HandoffBlockLabels
    readonly send: HandoffBlockSend
}

/** Actions the pure half emits; every argument is an atom, the send overlay's five flat. */
export type HandoffBlockActions = {
    readonly requestSend: (input: SendInput) => void
    readonly retryOrder: () => void
    readonly retryHandoff: () => void
    readonly sendClose: () => void
    readonly sendChange: (field: "fingerprint" | "revision" | "note", value: string) => void
    readonly sendReview: () => void
    readonly sendBack: () => void
    readonly sendConfirm: () => void
}

/** Complete input of HandoffBlockBase. */
export type HandoffBlockBaseProps = {
    readonly state: HandoffStatus
    readonly props: HandoffBlockData
    readonly on: HandoffBlockActions
}

const orderPlaceholder: OrderView = {
    code: "SO-0000-000",
    customer: "",
    amountText: "",
    lines: [{ sku: "SKU", qty: 1 }],
}
const handoffPlaceholder: Handoff = { status: "prepared", fingerprint: "fp-0000", revision: 0 }

/** Pure half: draws one of three shapes; each slot renders its own status through SlotView. */
export const HandoffBlockBase = (props: HandoffBlockBaseProps) => {
    const { labels } = props.props
    const order = (
        <SlotView
            slot={props.props.order}
            placeholder={orderPlaceholder}
            labels={labels.orderSlot}
            onRetry={props.on.retryOrder}
        >
            {(value, isSkeleton) => (
                <>
                    <OrderSummary
                        customer={value.customer}
                        code={value.code}
                        amount={value.amountText}
                        customerTerm={labels.customer}
                        amountTerm={labels.amount}
                        isSkeleton={isSkeleton}
                    />
                    {isSkeleton ? null : (
                        <OrderDisclosure lines={value.lines} title={`${value.lines.length} ${labels.lines}`} />
                    )}
                </>
            )}
        </SlotView>
    )
    const send = (value: Handoff, label: string, isSkeleton: boolean) => (
        <Button
            variant="primary"
            isSkeleton={isSkeleton}
            onPress={() => props.on.requestSend({ fingerprint: value.fingerprint, revision: value.revision })}
        >
            {label}
        </Button>
    )

    return (
        <>
            <SurfaceCard label={labels.title}>
                <div className={handoffBlockBodyClassName}>
                    {props.state === "prepared" ? (
                        <>
                            <div className={handoffBlockHeaderClassName}>
                                <StatusChip label={labels.prepared} tone="neutral" />
                            </div>
                            {order}
                            <SlotView
                                slot={props.props.handoff}
                                placeholder={handoffPlaceholder}
                                labels={labels.handoffSlot}
                                onRetry={props.on.retryHandoff}
                            >
                                {(value, isSkeleton) => (
                                    <div className={handoffBlockActionsClassName}>
                                        <Text isSkeleton={isSkeleton}>
                                            {labels.fingerprint} {value.fingerprint} · {labels.revision}{" "}
                                            {value.revision}
                                        </Text>
                                        {send(value, labels.send, isSkeleton)}
                                    </div>
                                )}
                            </SlotView>
                        </>
                    ) : null}

                    {props.state === "sent" ? (
                        <>
                            <div className={handoffBlockHeaderClassName}>
                                <StatusChip label={labels.sent} tone="success" />
                            </div>
                            {order}
                            <SlotView
                                slot={props.props.handoff}
                                placeholder={handoffPlaceholder}
                                labels={labels.handoffSlot}
                                onRetry={props.on.retryHandoff}
                            >
                                {(value, isSkeleton) => (
                                    <Text isSkeleton={isSkeleton}>
                                        {labels.receipt} {value.receiptId}
                                    </Text>
                                )}
                            </SlotView>
                        </>
                    ) : null}

                    {props.state === "returned" ? (
                        <>
                            <div className={handoffBlockHeaderClassName}>
                                <StatusChip label={labels.returned} tone="danger" />
                            </div>
                            <SlotView
                                slot={props.props.handoff}
                                placeholder={handoffPlaceholder}
                                labels={labels.handoffSlot}
                                onRetry={props.on.retryHandoff}
                            >
                                {(value, isSkeleton) => (
                                    <div className={handoffBlockActionsClassName}>
                                        <Text isSkeleton={isSkeleton}>
                                            {labels.reason}: {value.reason}
                                        </Text>
                                        {send(value, labels.resend, isSkeleton)}
                                    </div>
                                )}
                            </SlotView>
                            {order}
                        </>
                    ) : null}
                </div>
            </SurfaceCard>
            <SendHandoffForm
                state={props.props.send.shape}
                props={props.props.send}
                on={{
                    close: props.on.sendClose,
                    change: props.on.sendChange,
                    review: props.on.sendReview,
                    back: props.on.sendBack,
                    confirm: props.on.sendConfirm,
                }}
            />
        </>
    )
}
