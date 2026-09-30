"use client"

import type { ReactNode } from "react"
import { useMediaQuery } from "@/hooks/ui"
import { WorkspaceLayoutBase } from "./component"

/** Input of WorkspaceLayout. */
type WorkspaceLayoutProps = {
    readonly workspaceId: string
    readonly activeModule: string
    readonly children: ReactNode
}

/** Connected half: picks the frame shape from the viewport. */
export const WorkspaceLayout = (props: WorkspaceLayoutProps) => {
    const isMobile = useMediaQuery("(max-width: 767px)")
    return (
        <WorkspaceLayoutBase
            state={isMobile ? "mobile" : "sidebar"}
            props={{ workspaceId: props.workspaceId, activeModule: props.activeModule }}
        >
            {props.children}
        </WorkspaceLayoutBase>
    )
}
