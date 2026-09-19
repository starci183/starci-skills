import { cn } from "@heroui/react"
import type { ReactNode } from "react"
import { Rail } from "../../branch/Rail/index.js"
import {
    workspaceShellClassName,
    workspaceShellCompactHeaderClassName,
    workspaceShellCompactNavigationClassName,
    workspaceShellFloatingLayerClassName,
    workspaceShellHeaderClassName,
    workspaceShellLayoutClassName,
    workspaceShellLeadingRuleClassName,
    workspaceShellNavigationClassName,
    workspaceShellPrimaryClassName,
    workspaceShellRailClassName,
} from "./classNames.js"

type SlotContent = Exclude<ReactNode, null | undefined | boolean>
type ShellOwnedMain = ({ readonly primaryLabel: string; readonly primaryLabelledBy?: never } | { readonly primaryLabel?: never; readonly primaryLabelledBy: string }) & { readonly mainLandmark?: "shell" }
type CallerOwnedMain = { readonly mainLandmark: "caller"; readonly primaryLabel?: never; readonly primaryLabelledBy?: never }
type WithNavigation = { readonly navigation: SlotContent; readonly navigationLabel: string; readonly navigationTrack?: "fixed" | "intrinsic"; readonly navigationVisibility?: "always" | "wide" }
type WithoutNavigation = { readonly navigation?: undefined; readonly navigationLabel?: never; readonly navigationTrack?: never; readonly navigationVisibility?: never }
type WithRail = { readonly rail: SlotContent; readonly railLabel: string; readonly railMode?: "flow" | "sticky"; readonly railWidth?: "compact" | "standard" | "wide"; readonly railInset?: "none" | "content"; readonly railPosition?: "leading" | "trailing"; readonly isRailLabelHidden?: boolean }
type WithoutRail = { readonly rail?: undefined; readonly railLabel?: never; readonly railMode?: never; readonly railWidth?: never; readonly railInset?: never; readonly railPosition?: never; readonly isRailLabelHidden?: never }
type WithCompactNavigation = { readonly compactNavigation: SlotContent; readonly compactNavigationLabel: string }
type WithoutCompactNavigation = { readonly compactNavigation?: undefined; readonly compactNavigationLabel?: never }

export type WorkspaceShellProps = (ShellOwnedMain | CallerOwnedMain) & (WithNavigation | WithoutNavigation) & (WithRail | WithoutRail) & (WithCompactNavigation | WithoutCompactNavigation) & {
    readonly header?: ReactNode
    readonly compactHeader?: ReactNode
    readonly primary: ReactNode
    readonly primaryId?: string
    readonly floatingLayer?: ReactNode
    readonly align?: "start" | "stretch"
    readonly className?: string
}

/** Shared product workspace anatomy; connected apps supply every route and business slot. */
export const WorkspaceShell = (props: WorkspaceShellProps) => {
    const hasHeader = props.header != null && typeof props.header !== "boolean"
    const hasCompactHeader = props.compactHeader != null && typeof props.compactHeader !== "boolean"
    const hasNavigation = props.navigation !== undefined
    const hasRail = props.rail !== undefined
    const hasCompactNavigation = props.compactNavigation !== undefined
    const railPosition = hasRail ? props.railPosition ?? "trailing" : undefined
    const hasFloatingLayer = props.floatingLayer != null && typeof props.floatingLayer !== "boolean"
    const mainLandmark = props.mainLandmark ?? "shell"
    const primary = mainLandmark === "caller" ? <div className={workspaceShellPrimaryClassName} data-contract="GAP-5" data-grammar-workspace-primary="true" data-grammar-main-landmark="caller" id={props.primaryId} tabIndex={-1}>{props.primary}</div> : <main aria-label={props.primaryLabel} aria-labelledby={props.primaryLabelledBy} className={workspaceShellPrimaryClassName} data-contract="GAP-5" data-grammar-workspace-primary="true" data-grammar-main-landmark="shell" id={props.primaryId} tabIndex={-1}>{props.primary}</main>
    const rail = hasRail ? <div className={workspaceShellRailClassName} data-grammar-workspace-rail-region="true"><Rail inset={props.railInset ?? "none"} isLabelHidden={props.isRailLabelHidden ?? true} label={props.railLabel} mode={props.railMode ?? "flow"} width={props.railWidth ?? "standard"}>{props.rail}</Rail></div> : null
    const leadingRule = railPosition === "leading" ? <div aria-hidden="true" className={workspaceShellLeadingRuleClassName} data-contract="BOUNDARY-4" data-grammar-workspace-leading-rule="true" /> : null

    return <div className={cn(workspaceShellClassName, props.className)} data-grammar-workspace-floating={hasFloatingLayer ? "present" : "absent"} data-grammar-workspace-shell="true">
        {hasHeader ? <header className={workspaceShellHeaderClassName} data-contract="MARGIN-5" data-grammar-workspace-header="true">{props.header}</header> : null}
        {hasCompactHeader ? <div className={workspaceShellCompactHeaderClassName} data-grammar-workspace-compact-header="true">{props.compactHeader}</div> : null}
        <div className={workspaceShellLayoutClassName} data-contract="GAP-5 MEASURE-1" data-grammar-workspace-align={props.align ?? "start"} data-grammar-workspace-navigation={hasNavigation ? "present" : "absent"} data-grammar-workspace-navigation-track={hasNavigation ? props.navigationTrack ?? "fixed" : undefined} data-grammar-workspace-navigation-visibility={hasNavigation ? props.navigationVisibility ?? "always" : undefined} data-grammar-workspace-rail={hasRail ? "present" : "absent"} data-grammar-workspace-rail-position={railPosition} data-grammar-workspace-rail-width={hasRail ? props.railWidth ?? "standard" : undefined}>
            {hasNavigation ? <nav aria-label={props.navigationLabel} className={workspaceShellNavigationClassName} data-grammar-workspace-navigation-region="true">{props.navigation}</nav> : null}
            {railPosition === "leading" ? rail : null}{leadingRule}{primary}{railPosition === "trailing" ? rail : null}
        </div>
        {hasCompactNavigation ? <nav aria-label={props.compactNavigationLabel} className={workspaceShellCompactNavigationClassName} data-contract="BOUNDARY-1" data-grammar-workspace-compact-navigation="true">{props.compactNavigation}</nav> : null}
        {hasFloatingLayer ? <div className={workspaceShellFloatingLayerClassName} data-contract="OVERFLOW-4" data-grammar-workspace-floating-layer="true">{props.floatingLayer}</div> : null}
    </div>
}
