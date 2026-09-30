import type { ReactNode } from "react"
import {
    Avatar,
    Breadcrumbs,
    Footer,
    PageContainer,
    Text,
    TextAction,
    WorkspaceShell,
    type BreadcrumbItem,
} from "@starci/grammar/common"
import { ROUTES } from "@/modules/routes"
import { ACCOUNT_CLUSTER_CLASS_NAME, HEADER_ROW_CLASS_NAME, PRIMARY_COLUMN_CLASS_NAME } from "./classNames"

/** Every word the signed-in workspace chrome renders, resolved by the connected half. */
export type AccountShellCopy = {
    readonly brand: string
    readonly accountName: string
    readonly signOut: string
    /** The accessible name of the destination row, in the side rail and in the compact band alike. */
    readonly navLabel: string
    /** The accessible name of the footer's legal links. */
    readonly legalLabel: string
    readonly destinations: {
        readonly tasks: string
        readonly notifications: string
        readonly plan: string
        readonly privacy: string
    }
    readonly legal: {
        readonly privacyPolicy: string
        readonly terms: string
    }
    readonly breadcrumbLabel: string
    /** The main landmark's accessible name. */
    readonly mainLabel: string
    readonly breadcrumb: string
}

/** The chrome's contract: its words, the destination this screen is, the sign-out intent and the screen's own content. */
type AccountShellProps = {
    readonly copy: AccountShellCopy
    /** The route of the destination this screen is; compared by route because labels are translated. */
    readonly currentHref: string
    readonly onSignOut: () => void
    /** The trail to this screen when it is deeper than the single `copy.breadcrumb` label. */
    readonly trail?: ReadonlyArray<BreadcrumbItem>
    readonly children: ReactNode
}

/** The four destinations' routes; their labels are copy. */
const DESTINATIONS = [
    { key: "tasks", href: ROUTES.tasks },
    { key: "notifications", href: ROUTES.notifyPreferences },
    { key: "plan", href: ROUTES.planUsage },
    { key: "privacy", href: ROUTES.privacy },
] as const

/** The policy routes every signed-in screen's footer names. */
const FOOTER_LINKS = [
    { key: "privacyPolicy", href: ROUTES.privacyPolicy },
    { key: "terms", href: ROUTES.terms },
] as const

type DestinationLinksProps = {
    readonly copy: AccountShellCopy
    readonly currentHref: string
}

const DestinationLinks = (props: DestinationLinksProps) => (
    <>
        {DESTINATIONS.map((destination) => (
            <TextAction
                key={destination.key}
                appearance="tab"
                href={destination.href}
                isCurrent={destination.href === props.currentHref}
            >
                {props.copy.destinations[destination.key]}
            </TextAction>
        ))}
    </>
)

type AccountPresenceProps = {
    readonly copy: AccountShellCopy
    readonly onSignOut: () => void
}

const AccountPresence = (props: AccountPresenceProps) => (
    <div className={ACCOUNT_CLUSTER_CLASS_NAME}>
        <Avatar name={props.copy.accountName} size="sm" isDecorative />
        <Text as="span">{props.copy.accountName}</Text>
        <TextAction appearance="inline" onPress={props.onSignOut}>
            {props.copy.signOut}
        </TextAction>
    </div>
)

/**
 * The one signed-in workspace chrome: the header, the destination rail (a compact band below the wide
 * breakpoint), the breadcrumb, the screen's own content and the legal footer. The shell owns the main
 * landmark, named by `copy.mainLabel`.
 */
export const AccountShell = (props: AccountShellProps) => {
    const copy = props.copy
    return (
        <WorkspaceShell
            primaryLabel={copy.mainLabel}
            header={
                <PageContainer measure="product">
                    <div className={HEADER_ROW_CLASS_NAME}>
                        <Text as="span" weight="semibold">
                            {copy.brand}
                        </Text>
                        <AccountPresence copy={copy} onSignOut={props.onSignOut} />
                    </div>
                </PageContainer>
            }
            navigation={<DestinationLinks copy={copy} currentHref={props.currentHref} />}
            navigationLabel={copy.navLabel}
            navigationTrack="intrinsic"
            navigationVisibility="wide"
            compactNavigation={<DestinationLinks copy={copy} currentHref={props.currentHref} />}
            compactNavigationLabel={copy.navLabel}
            primary={
                <PageContainer measure="product">
                    <div className={PRIMARY_COLUMN_CLASS_NAME}>
                        <Breadcrumbs
                            label={copy.breadcrumbLabel}
                            items={props.trail ?? [{ id: "current", label: copy.breadcrumb }]}
                        />
                        {props.children}
                        <Footer
                            label={copy.legalLabel}
                            groups={[
                                {
                                    id: "legal",
                                    label: copy.legalLabel,
                                    links: FOOTER_LINKS.map((link) => ({
                                        id: link.key,
                                        label: copy.legal[link.key],
                                        href: link.href,
                                    })),
                                },
                            ]}
                        />
                    </div>
                </PageContainer>
            }
        />
    )
}
