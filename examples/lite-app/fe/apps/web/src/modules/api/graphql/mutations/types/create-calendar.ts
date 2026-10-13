import type { CreateCalendarMutation, CreateCalendarMutationVariables } from "../../__generated__/graphql"

/** What mutateCreateCalendar takes: the variables of the `createCalendar` mutation (none: the caller owns the row). */
export type MutateCreateCalendarRequest = CreateCalendarMutationVariables

/** What mutateCreateCalendar answers: the `createCalendar` field. */
export type MutateCreateCalendarData = CreateCalendarMutation["createCalendar"]
