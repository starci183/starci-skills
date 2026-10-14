import useSWR from "swr"
import type { GraphQLResponse } from "@/modules/api"
import { queryCalendar } from "@/modules/api/graphql/queries/query-calendar"
import type { QueryCalendarData } from "@/modules/api/graphql/queries/types/calendar"

/** The SWR key of the calendar query; the full key carries the row id, the identity of its result. */
export const QUERY_CALENDAR_SWR_KEY = "QUERY_CALENDAR_SWR"

/** One calendar row of the signed-in reader by id, as its GraphQLResponse; no id, no request. */
export const useQueryCalendarSwr = (id: string | undefined) =>
    useSWR(
        id === undefined ? null : ([QUERY_CALENDAR_SWR_KEY, id] as const),
        ([, rowId]): Promise<GraphQLResponse<QueryCalendarData>> => queryCalendar({ request: { id: rowId } }),
    )
