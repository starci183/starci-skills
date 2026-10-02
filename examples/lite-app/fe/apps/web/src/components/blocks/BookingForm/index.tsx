"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { writeBookings } from "@/modules/db/bookings/write-bookings"
import { writeResources } from "@/modules/db/resources/write-resources"
import { BookingFormBase } from "./component"

type FormFailure = "refused" | "not-found" | "invalid" | "unavailable"
type FormResult = "created" | FormFailure | undefined

const idOf = (input: FormData, name: string): { readonly id: string } => ({ id: String(input.get(name) ?? "") })

/** The connected booking block writes through principal-aware Server Actions. */
export const BookingForm = () => {
    const t = useTranslations("app.booking")
    const [resourcePending, startResourceTransition] = useTransition()
    const [bookingPending, startBookingTransition] = useTransition()
    const [resourceResult, setResourceResult] = useState<FormResult>()
    const [bookingResult, setBookingResult] = useState<FormResult>()
    const addResource = (input: FormData) => {
        startResourceTransition(async () => {
            const result = await writeResources(idOf(input, "resourceId"))
            setResourceResult(result.kind === "ok" ? "created" : result.kind)
        })
    }
    const addBooking = (input: FormData) => {
        startBookingTransition(async () => {
            const result = await writeBookings(idOf(input, "bookingId"))
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
