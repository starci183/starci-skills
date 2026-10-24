"use client"

import { useEffect } from "react"
import { useSWRConfig } from "swr"
import { QUERY_BOOKING_STATUS_SWR_KEY } from "@/hooks/swr"
import { streamBookingStatus } from "@/modules/api/sse/booking-status/stream-booking-status"

/**
 * Keeps the booking-status SWR entries current from the back end's event stream: each push writes its booking's entry, and each
 * (re)open of the stream reads the watched booking once, which closes the gap since the last push. The stream is opened while a
 * booking is watched and closed when it is not or the component leaves. The status query does not poll while this runs.
 */
export const useBookingStatusStream = (bookingId: string | undefined): void => {
    const { mutate } = useSWRConfig()
    useEffect(() => {
        if (bookingId === undefined) return
        const controller = new AbortController()
        void streamBookingStatus({
            signal: controller.signal,
            onOpen: () => void mutate([QUERY_BOOKING_STATUS_SWR_KEY, bookingId]),
            onPush: (push) =>
                void mutate([QUERY_BOOKING_STATUS_SWR_KEY, push.bookingId], { id: push.bookingId, status: push.status }, { revalidate: false }),
        })
        return () => controller.abort()
    }, [bookingId, mutate])
}
