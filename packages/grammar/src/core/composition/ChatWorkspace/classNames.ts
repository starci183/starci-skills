import { cn } from "@heroui/react"

/**
 * Chat-workspace geometry is SHIPPED.
 *
 * The bounded height chain, the rail track, the composer boundary and the compact drawer are all
 * drawn by `.starci-core-chat-workspace*` in `src/common/styles.css`. The names below are hooks;
 * the rail-less layout keeps its own class because it is a structural variant, not a utility.
 */

/** Bounded height chain for a workbench supplied with height by its host. */
export const chatWorkspaceClassName = cn("starci-core-chat-workspace") ?? "starci-core-chat-workspace"

/** Header remains outside every workspace-owned scroll region. */
export const chatWorkspaceHeaderClassName = cn("starci-core-chat-workspace-header") ?? "starci-core-chat-workspace-header"

/** Compact rail disclosure has its own non-scrolling action boundary. */
export const chatWorkspaceRailTriggerBoundaryClassName = cn("starci-core-chat-workspace-rail-trigger-boundary") ?? "starci-core-chat-workspace-rail-trigger-boundary"

/** Visible, keyboard-sized trigger for the compact supporting overlay. */
export const chatWorkspaceRailTriggerClassName = cn("starci-core-chat-workspace-rail-trigger") ?? "starci-core-chat-workspace-rail-trigger"

/** Primary work region and the persistent rail share the remaining bounded height. */
export const chatWorkspaceLayoutClassName = cn("starci-core-chat-workspace-layout") ?? "starci-core-chat-workspace-layout"

/** Bind the layout column to the same authored widths as Core Rail. */
export const getChatWorkspaceLayoutClassName = (
    _railWidth: "compact" | "standard" | "wide",
    hasRail: boolean,
) => cn(chatWorkspaceLayoutClassName, !hasRail && "starci-core-chat-workspace-layout-without-rail")

/** Main task owner: only its conversation child scrolls. */
export const chatWorkspacePrimaryClassName = cn("starci-core-chat-workspace-primary") ?? "starci-core-chat-workspace-primary"

/** The conversation is the single primary bounded scroll owner. */
export const chatWorkspaceConversationClassName = cn("starci-core-chat-workspace-conversation") ?? "starci-core-chat-workspace-conversation"

/** Composer remains reachable at the terminal edge without duplicating scroll padding. */
export const chatWorkspaceComposerClassName = cn("starci-core-chat-workspace-composer") ?? "starci-core-chat-workspace-composer"

/** Persistent supporting rail fills the same bounded layout track as the task owner. */
export const chatWorkspaceInlineRailClassName = cn("starci-core-chat-workspace-inline-rail") ?? "starci-core-chat-workspace-inline-rail"

/** Keep the compact vendor drawer on one safe viewport width. */
export const chatWorkspaceDrawerContentClassName = cn("starci-core-chat-workspace-drawer-content") ?? "starci-core-chat-workspace-drawer-content"

/** The dialog and its body extend the bounded height chain into the overlay. */
export const chatWorkspaceDrawerDialogClassName = cn("starci-core-chat-workspace-drawer-dialog") ?? "starci-core-chat-workspace-drawer-dialog"
export const chatWorkspaceDrawerBodyClassName = cn("starci-core-chat-workspace-drawer-body") ?? "starci-core-chat-workspace-drawer-body"

/** Scroll owner inside the compact supporting overlay. */
export const chatWorkspaceOverlayRailClassName = cn("starci-core-chat-workspace-overlay-rail") ?? "starci-core-chat-workspace-overlay-rail"

/** Make the vendor-provided overlay exit easy to target in every input mode. */
export const chatWorkspaceDrawerCloseClassName = cn("starci-core-chat-workspace-drawer-close") ?? "starci-core-chat-workspace-drawer-close"
