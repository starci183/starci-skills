import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import type { CreateBookingMutation, CreateBookingMutationVariables } from "../__generated__/graphql"
import { createAuthApolloClient, graphqlResponseOf } from "../clients"
import type { GraphQLResponse, OperationParams } from "../types"
import type { MutateCreateBookingData, MutateCreateBookingRequest } from "./types/create-booking"

/** The `createBooking` mutation of the back end (be/src/features/api/bookings, create-booking). */
const MUTATION_CREATE_BOOKING: TypedDocumentNode<CreateBookingMutation, CreateBookingMutationVariables> = gql`
    mutation CreateBooking($input: CreateBookingInput!) {
        createBooking(input: $input) {
            id
            resourceId
            startsAt
            endsAt
            status
        }
    }
`

/** Books a resource of the signed-in reader; the booking is pending until its confirmation job ran (bookingStatus). */
export const mutateCreateBooking = async ({
    request,
    signal,
}: OperationParams<MutateCreateBookingRequest>): Promise<GraphQLResponse<MutateCreateBookingData>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ signal }).mutate({
            mutation: MUTATION_CREATE_BOOKING,
            variables: { input: request },
        }),
        (data) => data.createBooking,
    )
