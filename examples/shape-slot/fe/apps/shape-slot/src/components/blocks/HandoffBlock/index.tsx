"use client"

import { useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { useQueryHandoffSwr, useQueryOrderSwr, useSendHandoffForm } from "@/hooks/sales"
import { toSlot, useSlotLabels } from "@/hooks/slot"
import type { HandoffStatus, OrderView, SendInput, Slot } from "@/modules/types"

import { HandoffBlockBase, handoffBlockDefaultState } from "./component"

/** Input of HandoffBlock: the handoff id, an atom. */
type HandoffBlockProps = { readonly handoffId: string }

/**
 * Connected half: HandoffBlockBase plus logic. Owns two independent apis, the send overlay's open
 * state and shape, picks the shape from data, resolves labels and formats the amount — every word
 * and every formatted value is settled here, so the pure half renders from atoms alone.
 */
export const HandoffBlock = (props: HandoffBlockProps) => {
    const t = useTranslations("sales.handoff")
    const tSend = useTranslations("sales.send")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const order = useQueryOrderSwr({ handoffId: props.handoffId })
    const handoff = useQueryHandoffSwr({ handoffId: props.handoffId })
    const [sendInput, setSendInput] = useState<SendInput>()
    const [sendShape, setSendShape] = useState<"form" | "confirm">("form")
    const closeSend = () => {
        setSendShape("form")
        setSendInput(undefined)
    }
    const form = useSendHandoffForm({
        handoffId: props.handoffId,
        input: sendInput,
        onReviewed: () => setSendShape("confirm"),
        onSent: closeSend,
    })
    const state: HandoffStatus = handoff.data?.status ?? handoffBlockDefaultState
    const orderSlot: Slot<OrderView> = {
        ...toSlot(order),
        items:
            order.data === undefined
                ? undefined
                : {
                      code: order.data.code,
                      customer: order.data.customer,
                      amountText: format.number(order.data.amount, { style: "currency", currency: "VND" }),
                      lines: order.data.lines,
                  },
    }

    return (
        <HandoffBlockBase
            state={state}
            props={{
                order: orderSlot,
                handoff: toSlot(handoff),
                send: {
                    isOpen: sendInput !== undefined,
                    shape: sendShape,
                    ...form.props,
                    labels: {
                        title: tSend("title"),
                        fingerprint: tSend("fingerprint"),
                        revision: tSend("revision"),
                        note: tSend("note"),
                        review: tSend("review"),
                        confirmQuestion: tSend("confirmQuestion"),
                        back: tSend("back"),
                        confirm: tSend("confirm"),
                    },
                },
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
                requestSend: (input) => {
                    setSendShape("form")
                    setSendInput(input)
                },
                retryOrder: () => {
                    void order.mutate()
                },
                retryHandoff: () => {
                    void handoff.mutate()
                },
                sendClose: closeSend,
                sendChange: form.on.change,
                sendReview: form.on.review,
                sendBack: () => setSendShape("form"),
                sendConfirm: form.on.confirm,
            }}
        />
    )
}
