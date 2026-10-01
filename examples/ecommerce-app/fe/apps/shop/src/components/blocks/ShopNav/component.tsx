import { TextAction } from "@starci/grammar/common"
import { shopNavClassNames } from "./classNames"

/** One resolved section link: the prefixed href, its label and the current-route marker. */
export type ShopNavLink = {
    readonly href: string
    readonly label: string
    readonly isCurrent: boolean
}

/** The shop nav's resolved inputs: its accessible name and every link settled. */
export type ShopNavBaseProps = {
    /** Whole-surface situations this nav settles; it has no alternatives. */
    readonly state: "ready"
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly label: string
        readonly links: ReadonlyArray<ShopNavLink>
    }
    /** What the surface reports upward; the nav is read-only. */
    readonly on: Record<never, never>
}

/** The section nav: one real `TextAction` destination per section, `isCurrent` being its real current marker. */
export const ShopNavBase = (props: ShopNavBaseProps) => (
    <div role="navigation" aria-label={props.props.label} className={shopNavClassNames.nav}>
        {props.props.links.map((link) => (
            <TextAction key={link.href} href={link.href} appearance="route" isCurrent={link.isCurrent}>
                {link.label}
            </TextAction>
        ))}
    </div>
)
