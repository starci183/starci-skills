import type { ReactNode } from "react"
import { GrammarRoot, PageContainer, TextAction, TopBar, WorkspaceShell } from "@starci/grammar/common"
import { siteShellClassNames } from "./classNames"

/** What an app's chrome hands the shell: the brand, its home link and the routed body. */
type SiteShellProps = {
    /** The wordmark; it also names the page's main landmark. */
    readonly brand: string
    /** The destination of the wordmark: the app's front door. */
    readonly homeHref: string
    /** The routed page body. */
    readonly children: ReactNode
}

/**
 * The document chrome both apps share: Grammar's Common boundary, the brand header (the top bar carrying the wordmark that links
 * home), then the routed body in the shell's main landmark at reading measure. Colours are the theme's semantic tokens.
 */
{{> fe/common/site-shell.tsx.partial}}
