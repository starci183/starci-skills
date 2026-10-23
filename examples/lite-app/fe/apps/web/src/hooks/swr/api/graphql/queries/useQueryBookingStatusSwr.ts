import useSWR from "swr"
import { queryBookingStatus } from "@/modules/api/graphql/queries/query-booking-status"
import type { QueryBookingStatusData } from "@/modules/api/graphql/queries/types/booking-status"

/** The SWR key of the booking-status query; the full key carries the booking id, the identity of its result. */
export const QUERY_BOOKING_STATUS_SWR_KEY = "QUERY_BOOKING_STATUS_SWR"

/** The key of one booking's status request; null while there is no booking id. */
type BookingStatusKey = readonly [typeof QUERY_BOOKING_STATUS_SWR_KEY, string] | null

/** How often a pending booking's status is read again while its confirmation job has not run. */
const POLL_INTERVAL_MS = 2_000

/** True once the confirmation job ran: the status never changes again, so polling stops. */
const isSettled = (data: QueryBookingStatusData | undefined): boolean => data?.status === "confirmed"

/**
 * The confirmation status of one booking of the signed-in reader by id; no id, no request. Polls every two seconds until the
 * booking is confirmed. A failure is thrown as the GraphQLResponse's message.
 */
export const useQueryBookingStatusSwr = (id: string | undefined) =>
    useSWR<QueryBookingStatusData, Error, BookingStatusKey>(
        id === undefined ? null : ([QUERY_BOOKING_STATUS_SWR_KEY, id] as const),
        async ([, bookingId]): Promise<QueryBookingStatusData> => {
            const response = await queryBookingStatus({ request: { id: bookingId } })
            if (!response.success) throw new Error(response.message, { cause: response })
            return response.data
        },
        { refreshInterval: (data) => (isSettled(data) ? 0 : POLL_INTERVAL_MS) },
    )
