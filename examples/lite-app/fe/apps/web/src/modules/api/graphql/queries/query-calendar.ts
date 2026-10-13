import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import type { CalendarQuery, CalendarQueryVariables } from "../__generated__/graphql"
import { createAuthApolloClient, graphqlResponseOf } from "../clients"
import type { GraphQLResponse, OperationParams } from "../types"
import type { QueryCalendarData, QueryCalendarRequest } from "./types/calendar"

/** The `calendar` query of the back end (be/src/features/api/calendars, get-calendar). */
const QUERY_CALENDAR: TypedDocumentNode<CalendarQuery, CalendarQueryVariables> = gql`
    query Calendar($input: GetCalendarInput!) {
        calendar(input: $input) {
            id
        }
    }
`

/** Reads one calendar row of the signed-in reader. */
export const queryCalendar = async ({
    request,
    signal,
}: OperationParams<QueryCalendarRequest>): Promise<GraphQLResponse<QueryCalendarData>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ signal }).query({ query: QUERY_CALENDAR, variables: { input: request } }),
        (data) => data.calendar,
    )
