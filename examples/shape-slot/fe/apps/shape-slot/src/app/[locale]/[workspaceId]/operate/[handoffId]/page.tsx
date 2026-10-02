import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { OperatePage } from "@/features/pages/OperatePage"

/** Route input of the operate page slot. */
export type PageProps = {
    readonly params: Promise<{ workspaceId: string; handoffId: string }>
}

/** The document title of the operate page, from the catalog of the requested locale. */
export const generateMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("sales.operate")
    return { title: t("title"), description: t("description") }
}

/** Route adapter: params become atoms, then the page owner renders. */
const Page = async (props: PageProps) => {
    const { handoffId } = await props.params
    return <OperatePage handoffId={handoffId} canEdit />
}

export default Page
