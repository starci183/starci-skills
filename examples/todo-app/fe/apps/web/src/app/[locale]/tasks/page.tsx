import { TasksPage } from "@/features/pages/TasksPage"
import { pageMetadata } from "@/modules/meta"

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("tasks")

/** The route adapter that mounts the tasks page and nothing else. */
const Page = () => <TasksPage />

export default Page
