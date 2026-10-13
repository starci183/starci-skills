"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"
import { useQueryBookingStatusSwr } from "@/hooks/swr"
import { toast } from "@/modules/toast"

/**
 * The confirmation status of one booking, polled through the booking-status SWR query until the confirm-booking job ran; the
 * terminal outcome is toasted once per booking.
 */
export const useBookingStatus = (bookingId: string | undefined) => {
    const t = useTranslations("app.booking")
    const { data, error, isLoading } = useQueryBookingStatusSwr(bookingId)
    const announced = useRef<string>(undefined)
    useEffect(() => {
        if (data?.status !== "confirmed" || announced.current === data.id) return
        announced.current = data.id
        toast.success(t("confirmedTitle"), { description: t("confirmed") })
    }, [data, t])
    return {
        status: data?.status,
        isLoading,
        error: error instanceof Error ? error.message : undefined,
    }
}
