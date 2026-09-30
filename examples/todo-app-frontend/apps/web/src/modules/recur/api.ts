import { graphql, type Result } from "@/modules/api"
import type { UpcomingOccurrences } from "@/modules/types"

/**
 * The recurrence capability's named GraphQL calls (fr.recur.make-recurring, fr.recur.see-upcoming and
 * fr.recur.end), reached through the app's one GraphQL client. Each returns the client's `Result`, so a
 * refusal reaches the schedule's own refused state as a sentence rather than as an exception.
 */

/** What makeRecurring answers with: the created rule's identity and its settled schedule. */
type MadeRule = {
  readonly ruleId: string;
  readonly title: string;
  readonly frequency: string;
  readonly timeZone: string;
  readonly time: string;
  readonly startDate: string;
};

/** The wire shape makeRecurring accepts; the frequency travels under its GraphQL enum literal. */
type MakeRecurringInput = {
  readonly title: string;
  readonly frequency: string;
  readonly n?: number;
  readonly dayOfMonth?: number;
  readonly timeZone: string;
  readonly time: string;
  readonly startDate: string;
};

/** What endRecurrence answers with: the date the rule settled on and how many occurrences it orphaned. */
type EndedRule = {
  readonly ruleId: string;
  readonly endedAt: string;
  readonly orphanedCount: number;
};

const MAKE_RECURRING_DOCUMENT =
  "mutation MakeRecurring($input: MakeRecurringInput!) { makeRecurring(request: $input) { ruleId title frequency timeZone time startDate } }"

const UPCOMING_OCCURRENCES_DOCUMENT =
  "query UpcomingOccurrences($ruleId: String!) { upcomingOccurrences(request: { ruleId: $ruleId }) { ruleId materialised { occurrenceId localDate dueAtUtc status } previewDates } }"

const END_RECURRENCE_DOCUMENT =
  "mutation EndRecurrence($input: EndRecurrenceInput!) { endRecurrence(request: $input) { ruleId endedAt orphanedCount } }"

/** Creates one recurrence rule from a task's title. */
export const makeRecurring = (token: string | null, input: MakeRecurringInput): Promise<Result<MadeRule>> =>
    graphql<MadeRule>(MAKE_RECURRING_DOCUMENT, { input }, token)

/** Reads a rule's stored occurrences and its live-computed preview. */
export const readUpcomingOccurrences = (token: string | null, ruleId: string): Promise<Result<UpcomingOccurrences>> =>
    graphql<UpcomingOccurrences>(UPCOMING_OCCURRENCES_DOCUMENT, { ruleId }, token)

/** Ends a rule on the given local date; the answer carries the date it settled on. */
export const endRecurrence = (token: string | null, ruleId: string, endedAt: string): Promise<Result<EndedRule>> =>
    graphql<EndedRule>(END_RECURRENCE_DOCUMENT, { input: { ruleId, endedAt } }, token)
