import { TaskSharePage } from "@/features/pages/TaskSharePage"
import { pageMetadata } from "@/modules/meta"

type PageProps = { readonly params: Promise<{ readonly taskId: string }> }

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("shareInvite")

/** The share route's thin shell; it hands the task the `[taskId]` segment names to the page component. */
const Page = async (props: PageProps) => <TaskSharePage taskId={(await props.params).taskId} />

export default Page
