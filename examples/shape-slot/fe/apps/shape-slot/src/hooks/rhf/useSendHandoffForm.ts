import { useEffect, useLayoutEffect, useRef } from "react"
import { useForm, useWatch, type UseFormReset } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import type { SendInput } from "@/modules/types"
import { z } from "zod"
import { useGetHandoffSwr, useGetSendAttemptsSwr, usePostSendHandoffSwr } from "../swr"

/** Builds validation with catalogue copy and exposes only the errors owned by this form. */
const useSendHandoffValidation = () => {
    const t = useTranslations()
    const fingerprintRequired = t("sales.send.errors.fingerprintRequired")
    const revisionMin = t("sales.send.errors.revisionMin")
    const noteTooLong = t("sales.send.errors.noteTooLong")
    const serverError = t("errors.page.title")
    const messages = [fingerprintRequired, revisionMin, noteTooLong, serverError]
    return {
        schema: z.object({
            fingerprint: z.string().trim().min(1, fingerprintRequired),
            revision: z.number(revisionMin).int(revisionMin).min(1, revisionMin),
            note: z.string().max(500, noteTooLong),
        }),
        serverError,
        errorOf: (message?: string) => (message !== undefined && messages.includes(message) ? message : undefined),
    }
}

/** Values of the send form, inferred from the schema so the two never drift. */
type SendHandoffFormValues = z.infer<ReturnType<typeof useSendHandoffValidation>["schema"]>

type UseSendHandoffFormParams = {
    readonly handoffId: string
    readonly input?: SendInput
    readonly onReviewed: () => void
    readonly onSent: () => void
    readonly onClosed: () => void
    readonly onBack: () => void
}

/** Resets the form and invalidates stale submissions whenever the send session changes. */
const useSendSessionVersion = (params: UseSendHandoffFormParams, reset: UseFormReset<SendHandoffFormValues>) => {
    const sessionVersion = useRef(0)
    useLayoutEffect(() => {
        sessionVersion.current += 1
        return () => {
            sessionVersion.current += 1
        }
    }, [params.handoffId, params.input])

    useEffect(() => {
        reset({ fingerprint: "", revision: 0, ...params.input, note: "" })
    }, [params.handoffId, params.input, reset])

    return sessionVersion
}

/** Owns validation, command feedback and one submission per open send session. */
export const useSendHandoffForm = (params: UseSendHandoffFormParams) => {
    const { schema, serverError, errorOf } = useSendHandoffValidation()
    const send = usePostSendHandoffSwr(params.handoffId)
    const handoff = useGetHandoffSwr({ handoffId: params.handoffId })
    const attempts = useGetSendAttemptsSwr({ handoffId: params.handoffId })
    const inFlight = useRef(false)
    const form = useForm<SendHandoffFormValues>({
        resolver: zodResolver(schema),
        defaultValues: { fingerprint: "", revision: 0, note: "" },
        mode: "onTouched",
    })
    const { reset } = form

    const sessionVersion = useSendSessionVersion(params, reset)

    const values = useWatch({ control: form.control })
    const errors = form.formState.errors
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
                    form.setError("root.send", { type: "server", message: serverError })
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
