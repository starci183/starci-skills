import type { ReactNode } from "react"
import { WorkspaceShell } from "@starci/grammar/common"
import { ModuleNavBlock } from "@/components/blocks/ModuleNavBlock"
import { WorkspaceHeaderBlock } from "@/components/blocks/WorkspaceHeaderBlock"

/** Atoms only, including the already-translated landmark words. */
export type WorkspaceLayoutData = {
    readonly workspaceId: string
    readonly activeModule: string
    readonly navLabel: string
    readonly primaryLabel: string
}

/** Props for WorkspaceLayoutBase. children is the router's slot, the one non-atom a layout takes. */
export type WorkspaceLayoutBaseProps = {
    readonly props: WorkspaceLayoutData
    readonly children: ReactNode
}

/**
 * Pure half: the workspace shell draws the sidebar shape on wide viewports and swaps the rail
 * for the compact navigation on narrow ones — the shell's own CSS picks the drawing, never a hook.
 */
export const WorkspaceLayoutBase = (props: WorkspaceLayoutBaseProps) => (
    <WorkspaceShell
        header={<WorkspaceHeaderBlock workspaceId={props.props.workspaceId} />}
        navigation={
            <ModuleNavBlock workspaceId={props.props.workspaceId} active={props.props.activeModule} density="full" />
        }
        navigationLabel={props.props.navLabel}
        navigationVisibility="wide"
        compactNavigation={
            <ModuleNavBlock workspaceId={props.props.workspaceId} active={props.props.activeModule} density="icon" />
        }
        compactNavigationLabel={props.props.navLabel}
        primaryLabel={props.props.primaryLabel}
        primary={props.children}
    />
)
