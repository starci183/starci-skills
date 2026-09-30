"use client"

import { useTranslations } from "next-intl"
import { useQueryHandoffSwr, useQueryOrderSwr } from "@/hooks/sales"
import { toSlot, useSlotLabels } from "@/hooks/slot"
import type { HandoffStatus, SendInput } from "@/modules/types"

import { HandoffBlockBase, handoffBlockDefaultState } from "./component"

/** Input of HandoffBlock: atoms (the id) and one action the page listens to. */
type HandoffBlockProps = {
    readonly handoffId: string
    readonly onRequestSend: (input: SendInput) => void
}

/**
 * Connected half: HandoffBlockBase plus logic. Owns two independent apis, picks the shape
 * from data, resolves labels. The only thing this folder exports to other tiers.
 */
export const HandoffBlock = (props: HandoffBlockProps) => {
    const t = useTranslations("sales.handoff")
    const slotLabels = useSlotLabels()
    const order = useQueryOrderSwr({ handoffId: props.handoffId })
    const handoff = useQueryHandoffSwr({ handoffId: props.handoffId })
    const state: HandoffStatus = handoff.data?.status ?? handoffBlockDefaultState

    return (
        <HandoffBlockBase
            state={state}
            props={{
                order: toSlot(order),
                handoff: toSlot(handoff),
                labels: {
                    title: t("title"),
                    prepared: t("prepared"),
                    sent: t("sent"),
                    returned: t("returned"),
                    send: t("send"),
                    resend: t("resend"),
                    fingerprint: t("fingerprint"),
                    revision: t("revision"),
                    receipt: t("receipt"),
                    reason: t("reason"),
                    customer: t("customer"),
                    amount: t("amount"),
                    lines: t("lines"),
                    orderSlot: slotLabels(t("emptyOrder")),
                    handoffSlot: slotLabels(t("emptyHandoff")),
                },
            }}
            on={{
                requestSend: props.onRequestSend,
                retryOrder: () => {
                    void order.mutate()
                },
                retryHandoff: () => {
                    void handoff.mutate()
                },
            }}
        />
    )
}
