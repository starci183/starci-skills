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
                resourceLabel: t("resource"),
                startsAtLabel: t("startsAt"),
                endsAtLabel: t("endsAt"),
                submitLabel: isSubmitting ? t("working") : t("submit"),
                bookingPending: isSubmitting,
                bookingStatus: statusText,
                resourceId: { value: fields.resourceId.value, errorMessage: fields.resourceId.errorMessage },
                startsAt: { value: fields.startsAt.value, errorMessage: fields.startsAt.errorMessage },
                endsAt: { value: fields.endsAt.value, errorMessage: fields.endsAt.errorMessage },
            }}
            on={{
                addResource: () => void resource.create(),
                addCalendar: () => void calendar.create(),
                book: () => void submit(),
                resourceIdChange: fields.resourceId.change,
                resourceIdBlur: fields.resourceId.blur,
                startsAtChange: fields.startsAt.change,
                startsAtBlur: fields.startsAt.blur,
                endsAtChange: fields.endsAt.change,
                endsAtBlur: fields.endsAt.blur,
            }}
        />
    )
}
