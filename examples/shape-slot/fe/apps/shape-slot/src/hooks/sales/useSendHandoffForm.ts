import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import type { SendInput } from "@/modules/types"
import { sendHandoffSchema, type SendHandoffFormValues } from "./sales.shared"
import { useMutateSendHandoffSwr } from "./useMutateSendHandoffSwr"

/** What the send form needs from its owner: the id, what to prefill, and the two moments that change shape. */
type UseSendHandoffFormParams = {
    readonly handoffId: string
    readonly input?: SendInput
    readonly onReviewed: () => void
    readonly onSent: () => void
}

/**
 * Owns the send form: react-hook-form + zod at the edge, the send command through its door, and the two
 * shape changes handed back to the owner. The block only sees field atoms and translated errors.
 */
export const useSendHandoffForm = (params: UseSendHandoffFormParams) => {
    const tRoot = useTranslations()
    const send = useMutateSendHandoffSwr(params.handoffId)
    const form = useForm<SendHandoffFormValues>({
        resolver: zodResolver(sendHandoffSchema),
        defaultValues: { fingerprint: "", revision: 0, note: "" },
        mode: "onTouched",
    })
    const { reset } = form

    useEffect(() => {
        if (params.input !== undefined) reset({ ...params.input, note: "" })
    }, [params.input, reset])

    const values = useWatch({ control: form.control })
    const errors = form.formState.errors
    const errorOf = (key?: string) => (key === undefined ? undefined : tRoot(key))

    return {
        props: {
            isSending: send.isMutating,
            fingerprint: { value: values.fingerprint ?? "", error: errorOf(errors.fingerprint?.message) },
            revision: { value: String(values.revision ?? 0), error: errorOf(errors.revision?.message) },
            note: { value: values.note ?? "", error: errorOf(errors.note?.message) },
        },
        on: {
            change: (field: "fingerprint" | "revision" | "note", value: string) => {
                const patch = { shouldValidate: true, shouldTouch: true }
                if (field === "revision") form.setValue("revision", Number(value), patch)
                else form.setValue(field, value, patch)
            },
            review: () => {
                void form.handleSubmit(() => params.onReviewed())()
            },
            confirm: () => {
                void form.handleSubmit(async (value) => {
                    await send.trigger({ fingerprint: value.fingerprint, revision: value.revision })
                    params.onSent()
                })()
            },
        },
    }
}
