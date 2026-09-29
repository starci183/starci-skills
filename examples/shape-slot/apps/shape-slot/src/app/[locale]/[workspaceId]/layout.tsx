import type { ReactNode } from "react"
import { WorkspaceLayout } from "@/features/layouts/WorkspaceLayout"

/** Route input of the workspace layout slot. */
export type LayoutProps = {
    readonly params: Promise<{ workspaceId: string }>
    readonly children: ReactNode
}

/** Route adapter: params become atoms, then the layout owner renders. */
const Layout = async (props: LayoutProps) => {
    const { workspaceId } = await props.params
    return (
        <WorkspaceLayout workspaceId={workspaceId} activeModule="sales-copilot">
            {props.children}
        </WorkspaceLayout>
    )
}

export default Layout
