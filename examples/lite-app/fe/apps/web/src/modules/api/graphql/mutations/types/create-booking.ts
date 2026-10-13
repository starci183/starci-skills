import type { CreateBookingMutation, CreateBookingMutationVariables } from "../../__generated__/graphql"

/** What mutateCreateBooking takes: the input of the `createBooking` mutation (generated from the back end's contract). */
export type MutateCreateBookingRequest = CreateBookingMutationVariables["input"]

/** What mutateCreateBooking answers: the `createBooking` field. */
export type MutateCreateBookingData = CreateBookingMutation["createBooking"]
