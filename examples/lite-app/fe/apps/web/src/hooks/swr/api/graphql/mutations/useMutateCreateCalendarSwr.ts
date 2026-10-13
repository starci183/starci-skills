import { useSWRConfig } from "swr"
import useSWRMutation from "swr/mutation"
import { mutateCreateCalendar } from "@/modules/api/graphql/mutations/mutation-create-calendar"
import { QUERY_CALENDAR_SWR_KEY } from "../queries/useQueryCalendarSwr"

/** The SWR key of the create-calendar mutation. */
export const MUTATE_CREATE_CALENDAR_SWR_KEY = "MUTATE_CREATE_CALENDAR_SWR"

/**
 * Creates one calendar row; answers the GraphQLResponse so the caller reports it through modules/toast
 * (useGraphQLWithToast). A success primes the calendar query of the new row, the resource the mutation is tied to.
 */
export const useMutateCreateCalendarSwr = () => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(MUTATE_CREATE_CALENDAR_SWR_KEY, async () => {
        const response = await mutateCreateCalendar({ request: {} })
        if (response.success)
            await mutate([QUERY_CALENDAR_SWR_KEY, response.data.id], response.data, { revalidate: false })
        return response
    })
}
