import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import type { BookingStatusQuery, BookingStatusQueryVariables } from "../__generated__/graphql"
import { createAuthApolloClient, graphqlResponseOf } from "../clients"
import type { GraphQLResponse, OperationParams } from "../types"
import type { QueryBookingStatusData } from "./types/booking-status"

/** The `bookingStatus` query of the back end (be/src/features/api/bookings, get-booking-status). */
const QUERY_BOOKING_STATUS: TypedDocumentNode<BookingStatusQuery, BookingStatusQueryVariables> = gql`
    query BookingStatus($input: GetBookingStatusInput!) {
        bookingStatus(input: $input) {
            id
            status
        }
    }
`

/** Reads the confirmation status of one booking of the signed-in reader. */
export const queryBookingStatus = async ({
    request,
    signal,
}: OperationParams<BookingStatusQueryVariables["input"]>): Promise<GraphQLResponse<QueryBookingStatusData>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ signal }).query({ query: QUERY_BOOKING_STATUS, variables: { input: request } }),
        (data) => data.bookingStatus,
    )
