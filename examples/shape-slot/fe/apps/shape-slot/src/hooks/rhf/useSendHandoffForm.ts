import { useEffect, useLayoutEffect, useRef } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import type { SendInput } from "@/modules/types"
import { z } from "zod"
import { useGetHandoffSwr, useGetSendAttemptsSwr, usePostSendHandoffSwr } from "../swr"

const revisionErrorMessage = "sales.send.errors.revisionMin"

/**
 * The send form, validated at the edge. Error messages are message KEYS, never prose:
 * the connected half resolves them with next-intl before they reach the pure half.
 */
const sendHandoffSchema = z.object({
    fingerprint: z.string().trim().min(1, "sales.send.errors.fingerprintRequired"),
    revision: z.number(revisionErrorMessage).int(revisionErrorMessage).min(1, revisionErrorMessage),
    note: z.string().max(500, "sales.send.errors.noteTooLong"),
})

/** Values of the send form, inferred from the schema so the two never drift. */
type SendHandoffFormValues = z.infer<typeof sendHandoffSchema>

type SendHandoffErrorKey =
    | "sales.send.errors.fingerprintRequired"
    | "sales.send.errors.revisionMin"
    | "sales.send.errors.noteTooLong"
    | "errors.page.title"

/** Resolve only the error keys owned by this form; unknown resolver messages are not UI copy. */
const sendHandoffErrorMessage = (translate: (key: SendHandoffErrorKey) => string, key?: string) => {
    switch (key) {
        case "sales.send.errors.fingerprintRequired":
            return translate("sales.send.errors.fingerprintRequired")
        case "sales.send.errors.revisionMin":
            return translate("sales.send.errors.revisionMin")
        case "sales.send.errors.noteTooLong":
            return translate("sales.send.errors.noteTooLong")
        case "errors.page.title":
            return translate("errors.page.title")
        default:
            return undefined
    }
}

type UseSendHandoffFormParams = {
    readonly handoffId: string
    readonly input?: SendInput
    readonly onReviewed: () => void
    readonly onSent: () => void
    readonly onClosed: () => void
    readonly onBack: () => void
}

/** Owns validation, command feedback and one submission per open send session. */
export const useSendHandoffForm = (params: UseSendHandoffFormParams) => {
    const tRoot = useTranslations()
    const send = usePostSendHandoffSwr(params.handoffId)
    const handoff = useGetHandoffSwr({ handoffId: params.handoffId })
    const attempts = useGetSendAttemptsSwr({ handoffId: params.handoffId })
    const inFlight = useRef(false)
    const sessionVersion = useRef(0)
    const form = useForm<SendHandoffFormValues>({
        resolver: zodResolver(sendHandoffSchema),
        defaultValues: { fingerprint: "", revision: 0, note: "" },
        mode: "onTouched",
    })
    const { reset } = form

    useLayoutEffect(() => {
        sessionVersion.current += 1
        return () => {
            sessionVersion.current += 1
        }
    }, [params.handoffId, params.input])

    useEffect(() => {
        reset({ fingerprint: "", revision: 0, ...params.input, note: "" })
    }, [params.handoffId, params.input, reset])

    const values = useWatch({ control: form.control })
    const errors = form.formState.errors
    const errorOf = (key?: string) => sendHandoffErrorMessage(tRoot, key)
    const isBusy = () => inFlight.current || send.isMutating
    const submit = (action: "review" | "confirm") => {
        if (isBusy() || params.input === undefined) return
        inFlight.current = true
        const version = sessionVersion.current
        form.clearErrors("root.send")
        void form
            .handleSubmit(async (value) => {
                if (version !== sessionVersion.current) return
                if (action === "confirm") {
                    await send.trigger({ fingerprint: value.fingerprint, revision: value.revision })
                    // The authoritative read revalidates before completion; the attempt history on its own.
                    await handoff.mutate()
                    void attempts.mutate()
                }
                if (version !== sessionVersion.current) return
                if (action === "confirm") params.onSent()
                else params.onReviewed()
            })()
            .catch(() => {
                if (version === sessionVersion.current) {
                    form.setError("root.send", { type: "server", message: "errors.page.title" })
                }
            })
            .finally(() => {
                inFlight.current = false
            })
    }

    return {
        props: {
            isSending: send.isMutating || form.formState.isSubmitting,
            error: errorOf(errors.root?.send?.message),
            fingerprint: { value: values.fingerprint ?? "", error: errorOf(errors.fingerprint?.message) },
            revision: { value: String(values.revision ?? 0), error: errorOf(errors.revision?.message) },
            note: { value: values.note ?? "", error: errorOf(errors.note?.message) },
        },
        on: {
            change: (field: "fingerprint" | "revision" | "note", value: string) => {
                if (isBusy()) return
                const patch = { shouldValidate: true, shouldTouch: true }
                if (field === "revision") form.setValue("revision", Number(value), patch)
                else form.setValue(field, value, patch)
            },
            review: () => submit("review"),
            confirm: () => submit("confirm"),
            close: () => {
                if (!isBusy()) params.onClosed()
            },
            back: () => {
                if (!isBusy()) params.onBack()
            },
        },
    }
}
