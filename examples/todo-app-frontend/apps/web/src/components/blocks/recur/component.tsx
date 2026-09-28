import { ScheduleScreenViewBase, type ScheduleScreenViewBaseProps } from "./schedule-screen"
import { RecurWorkspaceBase, type RecurWorkspaceBaseProps } from "./workspace"

type ScheduleBlockViewProps = ScheduleScreenViewBaseProps
type RecurWorkspaceViewProps = RecurWorkspaceBaseProps
type ScheduleScreenViewViewProps = ScheduleScreenViewBaseProps

/** Draw the settled schedule state handed down by the recurrence owner. */
export const ScheduleBlockView = (props: ScheduleBlockViewProps) =>
    <ScheduleScreenViewBase {...props} />

/** Draw the recurrence workspace from copy and actions the owner resolved. */
export const RecurWorkspaceView = (props: RecurWorkspaceViewProps) =>
    <RecurWorkspaceBase {...props} />

/** Draw the schedule state for the existing direct view entry. */
export const ScheduleScreenViewView = (props: ScheduleScreenViewViewProps) =>
    <ScheduleScreenViewBase {...props} />
