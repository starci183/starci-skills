"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { writeBookings } from "@/modules/db/bookings/write-bookings"
import { writeResources } from "@/modules/db/resources/write-resources"
import { BookingFormBase } from "./component"

type FormFailure = "refused" | "not-found" | "invalid" | "unavailable"
type FormResult = "created" | FormFailure | undefined

const valueOf = (input: FormData, name: string): string => {
    const value = input.get(name)
    return typeof value === "string" ? value : ""
}

/** The connected booking block writes resources and resource intervals through principal-aware Server Actions. */
export const BookingForm = () => {
    const t = useTranslations("app.booking")
    const [resourcePending, startResourceTransition] = useTransition()
    const [bookingPending, startBookingTransition] = useTransition()
    const [resourceResult, setResourceResult] = useState<FormResult>()
    const [bookingResult, setBookingResult] = useState<FormResult>()
    const addResource = (input: FormData) => {
        startResourceTransition(async () => {
            const result = await writeResources({ id: valueOf(input, "resourceId") })
            setResourceResult(result.kind === "ok" ? "created" : result.kind)
        })
    }
    const addBooking = (input: FormData) => {
        startBookingTransition(async () => {
            const result = await writeBookings({
                id: valueOf(input, "bookingId"),
                resourceId: valueOf(input, "bookingResourceId"),
                startsAt: valueOf(input, "startsAt"),
                endsAt: valueOf(input, "endsAt"),
            })
            setBookingResult(result.kind === "ok" ? "created" : result.kind)
        })
    }
    const messageOf = (result: FormResult) => (result === undefined ? undefined : t(result))
    return (
        <BookingFormBase
            props={{
                title: t("title"),
                resourceLabel: t("resource"),
                bookingLabel: t("booking"),
                bookingResourceLabel: t("bookingResource"),
                startsAtLabel: t("startsAt"),
                endsAtLabel: t("endsAt"),
                addResourceLabel: resourcePending ? t("working") : t("addResource"),
                addBookingLabel: bookingPending ? t("working") : t("addBooking"),
                resourcePending,
                bookingPending,
                resourceMessage: messageOf(resourceResult),
                bookingMessage: messageOf(bookingResult),
            }}
            on={{ resource: addResource, booking: addBooking }}
        />
    )
}
