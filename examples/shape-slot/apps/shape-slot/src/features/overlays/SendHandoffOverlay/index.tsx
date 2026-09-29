"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMutateSendHandoffSwr } from "@/hooks/sales"
import type { SendInput } from "@/modules/api/sales"
import { sendHandoffSchema, type SendHandoffFormValues } from "@/modules/api/sales/schemas"
import {
    SendHandoffOverlayBase,
    sendHandoffOverlayDefaultState,
    type SendHandoffOverlayState,
} from "./component"

/** Props for SendHandoffOverlay: the id, what to prefill (undefined = closed), and how to close. */
export type SendHandoffOverlayProps = {
    readonly handoffId: string
    readonly input?: SendInput
    readonly onClose: () => void
}

/**
 * Connected half: owns the form (react-hook-form + zod) and the send command (SWR mutation).
 * It reads no data, so it has no slot. The pure half only sees values, translated errors and actions.
 */
export const SendHandoffOverlay = (props: SendHandoffOverlayProps) => {
    const t = useTranslations("sales.send")
    const tRoot = useTranslations()
    const send = useMutateSendHandoffSwr(props.handoffId)
    const [state, setState] = useState<SendHandoffOverlayState>(sendHandoffOverlayDefaultState)
    const form = useForm<SendHandoffFormValues>({
        resolver: zodResolver(sendHandoffSchema),
        defaultValues: { fingerprint: "", revision: 0, note: "" },
        mode: "onTouched",
    })

    useEffect(() => {
        if (props.input !== undefined) form.reset({ ...props.input, note: "" })
    }, [props.input])

    const values = form.watch()
    const errors = form.formState.errors
    const errorOf = (key?: string) => (key === undefined ? undefined : tRoot(key))

    const onClose = () => {
        setState(sendHandoffOverlayDefaultState)
        props.onClose()
    }

    return (
        <SendHandoffOverlayBase
            state={state}
            props={{
                isOpen: props.input !== undefined,
                isSending: send.isMutating,
                fingerprint: { value: values.fingerprint, error: errorOf(errors.fingerprint?.message) },
                revision: { value: String(values.revision), error: errorOf(errors.revision?.message) },
                note: { value: values.note, error: errorOf(errors.note?.message) },
                labels: {
                    title: t("title"),
                    fingerprint: t("fingerprint"),
                    revision: t("revision"),
                    note: t("note"),
                    review: t("review"),
                    confirmQuestion: t("confirmQuestion"),
                    back: t("back"),
                    confirm: t("confirm"),
                },
            }}
            on={{
                close: onClose,
                change: (field, value) => {
                    const next = field === "revision" ? Number(value) : value
                    form.setValue(field, next as never, { shouldValidate: true, shouldTouch: true })
                },
                review: () => {
                    void form.handleSubmit(() => setState("confirm"))()
                },
                back: () => setState("form"),
                confirm: () => {
                    void form.handleSubmit(async (value) => {
                        await send.trigger({ fingerprint: value.fingerprint, revision: value.revision })
                        onClose()
                    })()
                },
            }}
        />
    )
}
