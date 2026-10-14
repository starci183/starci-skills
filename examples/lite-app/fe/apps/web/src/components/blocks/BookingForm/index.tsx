"use client"

import { useTranslations } from "next-intl"
import { useSession } from "@/hooks/auth"
import { useBookingStatus, useWorkspaceCommands } from "@/hooks/bookings"
import { useBookingForm } from "@/hooks/rhf"
import { BookingFormBase } from "./component"

/**
 * The connected booking workspace of a signed-in reader: resources and calendars are created and bookings are made through
 * the back end's GraphQL API (hooks only); a new booking's status is polled until its confirmation job ran.
 */
export const BookingForm = () => {
    const session = useSession()
    const t = useTranslations("app.booking")
    const workspace = useTranslations("app.workspace")
    const { resource, calendar } = useWorkspaceCommands()
    const { fields, submit, isSubmitting, bookingId } = useBookingForm()
    const status = useBookingStatus(bookingId)
    if (session.status !== "signed-in") return null
    const statusText =
        bookingId === undefined
            ? undefined
            : (status.error ?? t("status", { id: bookingId, status: status.status ?? t("statusUnknown") }))
    return (
        <BookingFormBase
            props={{
                title: workspace("title"),
                commandsLabel: workspace("commands"),
                addResourceLabel: resource.isCreating ? workspace("working") : workspace("addResource"),
                addCalendarLabel: calendar.isCreating ? workspace("working") : workspace("addCalendar"),
                resourcePending: resource.isCreating,
                calendarPending: calendar.isCreating,
                lastResource:
                    resource.createdId === undefined
                        ? undefined
                        : workspace("lastResource", { id: resource.createdId }),
                lastCalendar:
                    calendar.createdId === undefined
                        ? undefined
                        : workspace("lastCalendar", { id: calendar.createdId }),
                bookingTitle: t("title"),
                submitLabel: isSubmitting ? t("working") : t("submit"),
                bookingPending: isSubmitting,
                bookingStatus: statusText,
                resourceId: { label: t("resource"), ...fields.resourceId.state },
                startsAt: { label: t("startsAt"), ...fields.startsAt.state },
                endsAt: { label: t("endsAt"), ...fields.endsAt.state },
            }}
            on={{
                addResource: () => void resource.create(),
                addCalendar: () => void calendar.create(),
                book: () => void submit(),
                resourceIdChange: fields.resourceId.on.change,
                resourceIdBlur: fields.resourceId.on.blur,
                startsAtChange: fields.startsAt.on.change,
                startsAtBlur: fields.startsAt.on.blur,
                endsAtChange: fields.endsAt.on.change,
                endsAtBlur: fields.endsAt.on.blur,
            }}
        />
    )
}
