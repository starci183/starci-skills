import { PlanUsagePage } from "@/features/pages/PlanUsagePage"
import { pageMetadata } from "@/modules/meta"

/** The document title of this page, from the catalog of the requested locale. */
export const generateMetadata = () => pageMetadata("planUsage")

/** The route adapter that mounts the plan usage page and nothing else. */
const Page = () => <PlanUsagePage />

export default Page
