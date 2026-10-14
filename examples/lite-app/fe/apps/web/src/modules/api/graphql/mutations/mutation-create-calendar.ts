import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import type { CreateCalendarMutation, CreateCalendarMutationVariables } from "../__generated__/graphql"
import { createAuthApolloClient, graphqlResponseOf } from "../clients"
import type { GraphQLResponse, OperationParams } from "../types"
import type { MutateCreateCalendarData } from "./types/create-calendar"

/** The `createCalendar` mutation of the back end (be/src/features/api/calendars, create-calendar). */
const MUTATION_CREATE_CALENDAR: TypedDocumentNode<CreateCalendarMutation, CreateCalendarMutationVariables> = gql`
    mutation CreateCalendar {
        createCalendar {
            id
        }
    }
`

/** Creates one calendar row owned by the signed-in reader. */
export const mutateCreateCalendar = async ({
    request,
    signal,
}: OperationParams<CreateCalendarMutationVariables>): Promise<GraphQLResponse<MutateCreateCalendarData>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ signal }).mutate({ mutation: MUTATION_CREATE_CALENDAR, variables: request }),
        (data) => data.createCalendar,
    )
