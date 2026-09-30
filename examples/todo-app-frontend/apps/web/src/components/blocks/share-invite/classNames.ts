import { cn } from "@heroui/react"

/** Field and controls stack inside the invite form. */
export const SHARE_FORM_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** The collaborator collection's page section - labelled, not carded: a repeated-row list inside a
 * `starci-core-surface` ancestor is the entity-list-in-card refusal the canon render check names. */
export const SHARE_COLLABORATOR_SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-2")

/** The collection's column header strip: muted surface, same tracks as the rows beneath it. */
export const SHARE_COLLABORATOR_HEADER_CLASS_NAME = cn(
    "grid",
    "grid-cols-[2fr_1fr_1fr_auto]",
    "items-center",
    "gap-4",
    "border-b",
    "border-separator",
    "bg-surface-secondary",
    "px-4",
    "py-2",
)

/** The rows share one list; separators come from each row's own bottom rule. */
export const SHARE_COLLABORATOR_ROWS_CLASS_NAME = cn("flex", "flex-col")

/** One collaborator row: person, access, status and the revoke action on shared tracks. */
export const SHARE_COLLABORATOR_ROW_CLASS_NAME = cn(
    "grid",
    "grid-cols-[2fr_1fr_1fr_auto]",
    "items-center",
    "gap-4",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
)
