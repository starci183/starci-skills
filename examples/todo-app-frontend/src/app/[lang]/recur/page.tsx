import { RecurPage } from "@/components/pages/RecurPage"
import "./recur.css"

/**
 * The recur route's thin shell; the page component reads the task the query names.
 *
 * ui.recur.schedule's surface route is the task's own schedule; the example backend's
 * makeRecurring contract identifies the task by its title (there is no taskId-to-rule lookup),
 * so the route binds it as ?task=<title> rather than inventing an id the API cannot resolve.
 */
const Page = () => <RecurPage />

export default Page
