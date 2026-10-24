import { eventStreamUrl } from "@/modules/config"
import { followEventStream } from "../stream/read-event-stream"
import type { StreamReporter } from "../stream/read-event-stream"

/** One status change the booking-status stream pushes (be/src/features/realtime/booking-status): the booking and its new status. */
export interface BookingStatusPush {
    readonly bookingId: string
    readonly status: string
}

/** What following the booking-status stream takes. */
export interface StreamBookingStatusParams {
    /** Stops the stream and its reconnects. */
    readonly signal: AbortSignal
    /** Called each time the stream (re)opens: read the current status once, which closes the gap since the last push. */
    readonly onOpen: () => void
    /** Called for each status change of a booking of the signed-in reader. */
    readonly onPush: (push: BookingStatusPush) => void
    /** Where a refused or broken attempt is reported. */
    readonly report?: StreamReporter
}

/** True when a parsed JSON value is a push of the stream: a booking id and a status. */
const isPush = (value: unknown): value is BookingStatusPush =>
    typeof value === "object" &&
    value !== null &&
    "bookingId" in value &&
    typeof value.bookingId === "string" &&
    "status" in value &&
    typeof value.status === "string"

/** The parsed JSON of an event, or undefined when its data is not JSON. */
const parsed = (data: string): unknown => {
    try {
        return JSON.parse(data)
    } catch {
        return undefined
    }
}

/** Follows the booking-status event stream of the signed-in reader (`GET /booking-status/stream`) until the signal aborts. */
export const streamBookingStatus = ({ signal, onOpen, onPush, report }: StreamBookingStatusParams): Promise<void> =>
    followEventStream({
        url: eventStreamUrl("/booking-status/stream"),
        signal,
        onOpen,
        onEvent: (event) => {
            const push = parsed(event.data)
            if (isPush(push)) onPush(push)
        },
        ...(report === undefined ? {} : { report }),
    })
