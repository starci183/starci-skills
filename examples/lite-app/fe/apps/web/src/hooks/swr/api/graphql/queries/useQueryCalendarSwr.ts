import useSWR from "swr"
import { queryCalendar } from "@/modules/api/graphql/queries/query-calendar"
import type { QueryCalendarData } from "@/modules/api/graphql/queries/types/calendar"

/** The SWR key of the calendar query; the full key carries the row id, the identity of its result. */
export const QUERY_CALENDAR_SWR_KEY = "QUERY_CALENDAR_SWR"

/** One calendar row of the signed-in reader by id; no id, no request. A failure is thrown as the GraphQLResponse's message. */
export const useQueryCalendarSwr = (id: string | undefined) =>
    useSWR(
        id === undefined ? null : ([QUERY_CALENDAR_SWR_KEY, id] as const),
        async ([, rowId]): Promise<QueryCalendarData> => {
            const response = await queryCalendar({ request: { id: rowId } })
            if (!response.success) throw new Error(response.message, { cause: response })
            return response.data
        },
    )
