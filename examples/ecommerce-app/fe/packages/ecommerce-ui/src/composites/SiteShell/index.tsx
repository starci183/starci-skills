import type { ReactNode } from "react"
import { GrammarRoot, TextAction, TopBar, WorkspaceShell } from "@starci/grammar/common"
import { siteShellClassNames } from "./classNames"

/** What an app's chrome hands the shell: its brand and home link, what sits in the bar, and the routed body. */
type SiteShellProps = {
    /** The wordmark; it also names the page's main landmark. */
    readonly brand: string
    /** The locale-prefixed destination of the wordmark. */
    readonly homeHref: string
    /** The primary destinations shown inline in the bar. */
    readonly navigation?: ReactNode
    /** The trailing actions of the bar. */
    readonly actions: ReactNode
    /** The closing region below the main landmark. */
    readonly footer?: ReactNode
    /** The routed page body. */
    readonly children: ReactNode
}

/**
 * The document chrome both apps share: Grammar's Common boundary carrying the brand, the top bar with the
 * wordmark and whatever each app puts in it, the routed body in the shell's main landmark, then the footer.
 * Colours are the theme's semantic tokens, so the frame follows the light/dark class the display controls paint.
 */
export const SiteShell = (props: SiteShellProps) => (
    <GrammarRoot className={siteShellClassNames.frame}>
        <WorkspaceShell
            primaryLabel={props.brand}
            header={
                <TopBar
                    brand={<TextAction href={props.homeHref}>{props.brand}</TextAction>}
                    navigation={props.navigation}
                    actions={props.actions}
                />
            }
            primary={props.children}
        />
        {props.footer}
    </GrammarRoot>
)
