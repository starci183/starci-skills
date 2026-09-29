import { OperatePage } from "@/features/pages/OperatePage"

/** Route input of the operate page slot. */
export type PageProps = {
    readonly params: Promise<{ workspaceId: string; handoffId: string }>
}

/** Route adapter: params become atoms, then the page owner renders. */
const Page = async (props: PageProps) => {
    const { handoffId } = await props.params
    return <OperatePage handoffId={handoffId} canEdit />
}

export default Page
