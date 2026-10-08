"use client"

import { useTranslations } from "next-intl"
import { useQuerySendAttemptsSwr } from "@/hooks/sales"
import { toSlot, useSlotLabels } from "@/hooks/slot"

import { SendHistoryBlockBase } from "./component"

/** Input of SendHistoryBlock: the id only. */
type SendHistoryBlockProps = { readonly handoffId: string }

/** Connected half: owns its one api. */
export const SendHistoryBlock = (props: SendHistoryBlockProps) => {
    const t = useTranslations("sales.history")
    const slotLabels = useSlotLabels()
    const attempts = useQuerySendAttemptsSwr({ handoffId: props.handoffId })
    return (
        <SendHistoryBlockBase
            props={{ attempts: toSlot(attempts), title: t("title"), slotLabels: slotLabels(t("empty")) }}
            on={{
                retry: () => {
                    void attempts.mutate()
                },
            }}
        />
    )
}
