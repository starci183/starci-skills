import type { ReactNode } from "react"

/** `narrow` shows the bar below 48rem only (the page header carries the command at wider widths); `always` at every width. */
export type PinnedActionBarVisibility = "narrow" | "always"

export type PinnedActionBarProps = {
    /** The one page command: a single `Button` (normally `variant="primary"`, `width="fill"`). */
    readonly children: ReactNode
    /** Accessible name of the bar (`role="group"`), e.g. the command's purpose. */
    readonly label: string
    /** Default `narrow`. */
    readonly visibility?: PinnedActionBarVisibility
}

/**
 * The page's primary command pinned to the bottom edge on a narrow screen, in thumb reach (UX-9 case-1):
 * sticky at the bottom of its scroll container, on `--surface` behind a 1px `--separator` top hairline
 * (BOUNDARY-1), inset 0.75rem above and 1rem at the sides and below - plus the device's bottom safe-area
 * inset. It holds one Button; it is not navigation (that is `BottomNav`). Hidden at 48rem and wider unless
 * `visibility="always"`, so the same command is shown once per viewport (LAYOUT-4 case-2).
 */
export const PinnedActionBar = ({ children, label, visibility = "narrow" }: PinnedActionBarProps) => (
    <div
        aria-label={label}
        className="starci-core-pinned-action-bar"
        data-component="PinnedActionBar"
        data-contract="BOUNDARY-1"
        data-grammar-pinned-visibility={visibility}
        data-tier="atom"
        role="group"
    >
        {children}
    </div>
)
