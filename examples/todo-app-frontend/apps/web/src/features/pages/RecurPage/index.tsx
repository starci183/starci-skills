import { RecurPageBase } from "./component"

/** The public props of the recur route: the `task` the query carried, when it carried one. */
type RecurPageProps = { readonly task: string | undefined }

/**
 * The recur route's connected half: it hands the task the query names down to the screen.
 *
 * ui.recur.schedule's surface route is the task's own schedule; the example backend's
 * makeRecurring contract identifies the task by its title (there is no taskId-to-rule lookup),
 * so the route binds it as `?task=<title>` rather than inventing an id the API cannot resolve.
 */
export const RecurPage = (props: RecurPageProps) => (
    <RecurPageBase
        state="ready"
        props={{ taskTitle: props.task === undefined || props.task === "" ? null : props.task }}
        on={{}}
    />
)
