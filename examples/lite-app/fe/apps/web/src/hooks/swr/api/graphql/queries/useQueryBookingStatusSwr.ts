import useSWR from "swr"
import { queryBookingStatus } from "@/modules/api/graphql/queries/query-booking-status"
import type { QueryBookingStatusData } from "@/modules/api/graphql/queries/types/booking-status"

/** The SWR key of the booking-status query; the full key carries the booking id, the identity of its result. */
export const QUERY_BOOKING_STATUS_SWR_KEY = "QUERY_BOOKING_STATUS_SWR"

/** The key of one booking's status request; null while there is no booking id. */
type BookingStatusKey = readonly [typeof QUERY_BOOKING_STATUS_SWR_KEY, string] | null

/**
 * The confirmation status of one booking of the signed-in reader by id; no id, no request. It does not poll: the booking-status
 * event stream (hooks/bookings/useBookingStatusStream) writes this entry when the status changes. A failure is thrown as the
 * GraphQLResponse's message.
 */
export const useQueryBookingStatusSwr = (id: string | undefined) =>
    useSWR<QueryBookingStatusData, Error, BookingStatusKey>(
        id === undefined ? null : ([QUERY_BOOKING_STATUS_SWR_KEY, id] as const),
        async ([, bookingId]): Promise<QueryBookingStatusData> => {
            const response = await queryBookingStatus({ request: { id: bookingId } })
            if (!response.success) throw new Error(response.message, { cause: response })
            return response.data
        },
    )
