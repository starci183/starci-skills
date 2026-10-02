import { NavLandmark, TextAction } from "@starci/grammar/common"

/** One resolved section link: the prefixed href, its label and the current-route marker. */
export type ShopNavLink = {
    readonly href: string
    readonly label: string
    readonly isCurrent: boolean
}

/** The shop nav's resolved inputs: its accessible name and every link settled. */
export type ShopNavBaseProps = {
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly label: string
        readonly links: ReadonlyArray<ShopNavLink>
    }
}

/** The section nav: one real `TextAction` destination per section, `isCurrent` being its real current marker. */
export const ShopNavBase = (props: ShopNavBaseProps) => (
    <NavLandmark label={props.props.label} layout="scrolling">
        {props.props.links.map((link) => (
            <TextAction key={link.href} href={link.href} appearance="route" isCurrent={link.isCurrent}>
                {link.label}
            </TextAction>
        ))}
    </NavLandmark>
)
