import type { CalendarQuery, CalendarQueryVariables } from "../../__generated__/graphql"

/** What queryCalendar takes: the input of the `calendar` query (generated from the back end's contract). */
export type QueryCalendarRequest = CalendarQueryVariables["input"]

/** What queryCalendar answers: the `calendar` field. */
export type QueryCalendarData = CalendarQuery["calendar"]
