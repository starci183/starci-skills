import { useSWRConfig } from "swr"
import useSWRMutation from "swr/mutation"
import { mutateCreateBooking } from "@/modules/api/graphql/mutations/mutation-create-booking"
import type { MutateCreateBookingRequest } from "@/modules/api/graphql/mutations/types/create-booking"
import { QUERY_BOOKING_STATUS_SWR_KEY } from "../queries/useQueryBookingStatusSwr"

/** What the trigger of the create-booking mutation hands its fetcher: the booking to create. */
interface CreateBookingTrigger {
    readonly arg: MutateCreateBookingRequest
}

/** The SWR key of the create-booking mutation. */
export const MUTATE_CREATE_BOOKING_SWR_KEY = "MUTATE_CREATE_BOOKING_SWR"

/**
 * Books a resource; answers the GraphQLResponse so the caller reports it through modules/toast (useGraphQLWithToast). A
 * success primes the booking-status query of the new booking with its pending status, which then polls until confirmed.
 */
export const useMutateCreateBookingSwr = () => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(MUTATE_CREATE_BOOKING_SWR_KEY, async (_key: string, { arg }: CreateBookingTrigger) => {
        const response = await mutateCreateBooking({ request: arg })
        if (response.success)
            await mutate(
                [QUERY_BOOKING_STATUS_SWR_KEY, response.data.id],
                { id: response.data.id, status: response.data.status },
                { revalidate: false },
            )
        return response
    })
}
