"use client"

import { GrammarRoot } from "@starci/grammar/common"
import { RecurWorkspace } from "@/components/blocks/recur"

/**
 * The public entry of the recur schedule feature; the app route mounts exactly this and nothing
 * else.
 *
 * Marked as a client boundary and wrapped in Grammar's own Common root, matching the established
 * feature entries under src/features/pages - which this module mirrors rather than joins, because
 * its connected state belongs to the recurrence block.
 */
export type RecurSchedulePageProps = {
  readonly taskTitle: string | null;
};

/** The recur schedule page mounted by the route: Grammar root plus the workspace shell. */
export const RecurSchedulePage = (props: RecurSchedulePageProps) => {
    return (
        <GrammarRoot>
            <RecurWorkspace taskTitle={props.taskTitle} />
        </GrammarRoot>
    )
}
