import type { ReactNode } from "react"
import { getTranslations } from "next-intl/server"
import { WorkspaceLayoutBase } from "./component"

/** Input of WorkspaceLayout. */
type WorkspaceLayoutProps = {
    readonly workspaceId: string
    readonly activeModule: string
    readonly children: ReactNode
}

/** Connected half: resolves the landmark words on the server; the shell owns the compact swap. */
export const WorkspaceLayout = async (props: WorkspaceLayoutProps) => {
    const t = await getTranslations("nav")
    return (
        <WorkspaceLayoutBase
            props={{
                workspaceId: props.workspaceId,
                activeModule: props.activeModule,
                navLabel: t("modules"),
                primaryLabel: t("primary"),
            }}
        >
            {props.children}
        </WorkspaceLayoutBase>
    )
}
