import type { ReactNode } from "react"
import { PrimaryRailLayout } from "@starci/grammar/common"
import { ModuleNavBlock } from "@/components/blocks/workspace/ModuleNavBlock"
import { WorkspaceHeaderBlock } from "@/components/blocks/workspace/WorkspaceHeaderBlock"
import { workspaceLayoutBottomBarClassName, workspaceLayoutMobileClassName } from "./classNames"

/** Shape of the frame: each value is one drawing. */
export type WorkspaceLayoutState = "sidebar" | "mobile"

/** Atoms only. */
export type WorkspaceLayoutData = {
    readonly workspaceId: string
    readonly activeModule: string
}

/** Props for WorkspaceLayoutBase. children is the router's slot, the one non-atom a layout takes. */
export type WorkspaceLayoutBaseProps = {
    readonly state: WorkspaceLayoutState
    readonly props: WorkspaceLayoutData
    readonly children: ReactNode
}

/** Pure half: hard-codes its blocks and hands them atoms. */
export const WorkspaceLayoutBase = (props: WorkspaceLayoutBaseProps) =>
    props.state === "sidebar" ? (
        <PrimaryRailLayout
            collapsedOrder="primary-first"
            rail={<ModuleNavBlock workspaceId={props.props.workspaceId} active={props.props.activeModule} density="full" />}
            primary={
                <>
                    <WorkspaceHeaderBlock workspaceId={props.props.workspaceId} />
                    {props.children}
                </>
            }
        />
    ) : (
        <div className={workspaceLayoutMobileClassName}>
            <WorkspaceHeaderBlock workspaceId={props.props.workspaceId} />
            {props.children}
            <div className={workspaceLayoutBottomBarClassName}>
                <ModuleNavBlock workspaceId={props.props.workspaceId} active={props.props.activeModule} density="icon" />
            </div>
        </div>
    )
