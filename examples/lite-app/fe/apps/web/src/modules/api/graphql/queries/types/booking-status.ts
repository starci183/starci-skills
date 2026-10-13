import type { BookingStatusQuery, BookingStatusQueryVariables } from "../../__generated__/graphql"

/** What queryBookingStatus takes: the input of the `bookingStatus` query (generated from the back end's contract). */
export type QueryBookingStatusRequest = BookingStatusQueryVariables["input"]

/** What queryBookingStatus answers: the `bookingStatus` field. */
export type QueryBookingStatusData = BookingStatusQuery["bookingStatus"]
