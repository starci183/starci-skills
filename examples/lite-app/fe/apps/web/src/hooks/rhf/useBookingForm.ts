"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useController, useForm } from "react-hook-form"
import type { Control } from "react-hook-form"
import { z } from "zod"
import { useMutateCreateBookingSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

type BookingMessageKey = "resourceInvalid" | "dateInvalid" | "intervalInvalid"

/** The bounded booking: one resource id and a valid, increasing UTC interval, with the reader's-language messages. */
const bookingSchemaOf = (t: (key: BookingMessageKey) => string) =>
    z
        .object({
            resourceId: z.uuid({ error: t("resourceInvalid") }),
            startsAt: z.iso.datetime({ error: t("dateInvalid") }),
            endsAt: z.iso.datetime({ error: t("dateInvalid") }),
        })
        .refine((value) => Date.parse(value.startsAt) < Date.parse(value.endsAt), {
            error: t("intervalInvalid"),
            path: ["endsAt"],
        })

/** The values of the booking form. */
type BookingValues = z.infer<ReturnType<typeof bookingSchemaOf>>

/** One controlled field of the form as a grammar Input takes it. */
const useField = (control: Control<BookingValues>, name: keyof BookingValues) => {
    const { field, fieldState } = useController({ control, name })
    return {
        value: field.value,
        errorMessage: fieldState.error?.message,
        change: field.onChange,
        blur: field.onBlur,
    }
}

/**
 * The booking form: react-hook-form with the zod schema, submitted through the create-booking SWR mutation and reported by
 * modules/toast. The back end answers at once with a pending booking and enqueues its confirmation job; `bookingId` is the
 * booking whose status the caller polls (useBookingStatus).
 */
export const useBookingForm = () => {
    const t = useTranslations("app.booking")
    const schema = useMemo(() => bookingSchemaOf(t), [t])
    const form = useForm<BookingValues>({
        resolver: zodResolver(schema),
        defaultValues: { resourceId: "", startsAt: "", endsAt: "" },
    })
    const runGraphQL = useGraphQLWithToast()
    const { trigger, isMutating } = useMutateCreateBookingSwr()
    const [bookingId, setBookingId] = useState<string>()
    const resourceId = useField(form.control, "resourceId")
    const startsAt = useField(form.control, "startsAt")
    const endsAt = useField(form.control, "endsAt")
    const submit = form.handleSubmit(async (values) => {
        const response = await runGraphQL(() => trigger(values), { successMessage: t("queued") })
        if (response.success) setBookingId(response.data.id)
    })
    return { fields: { resourceId, startsAt, endsAt }, submit, isSubmitting: isMutating, bookingId }
}
