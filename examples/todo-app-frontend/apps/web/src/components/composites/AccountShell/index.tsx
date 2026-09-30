import type { ReactNode } from "react"
import { PageContainer, Text, TextAction, WorkspaceShell } from "@starci/grammar/common"
import {
    ACCOUNT_CLUSTER_CLASS_NAME,
    ACCOUNT_SHELL_AVATAR_CLASS_NAME,
    COMPACT_HEADER_CLASS_NAME,
    FOOTER_ROW_CLASS_NAME,
    ACCOUNT_SHELL_HEADER_BAR_CLASS_NAME,
    HEADER_BRAND_NAV_CLASS_NAME,
    HEADER_NAV_LIST_CLASS_NAME,
    HEADER_ROW_CLASS_NAME,
    PRIMARY_COLUMN_CLASS_NAME,
} from "./classNames"

/** Every word the signed-in workspace chrome renders, resolved by the connected half. */
export type AccountShellCopy = {
  readonly brand: string;
  readonly accountName: string;
  readonly signOut: string;
  /** The accessible name of the destination row, in the header and in the compact band alike. */
  readonly navLabel: string;
  readonly destinations: {
    readonly tasks: string;
    readonly notifications: string;
    readonly plan: string;
    readonly privacy: string;
  };
  readonly legal: {
    readonly privacyPolicy: string;
    readonly terms: string;
  };
  readonly breadcrumbLabel: string;
  /** The main landmark's accessible name. */
  readonly mainLabel: string;
  readonly breadcrumb: string;
};

/** The chrome's contract: its words, the destination this screen is, the sign-out intent and the screen's own content. */
type AccountShellProps = {
  readonly copy: AccountShellCopy;
  /** The route of the destination this screen is; compared by route because labels are translated. */
  readonly currentHref: string;
  readonly onSignOut: () => void;
  readonly children: ReactNode;
};

/** The four destinations' routes; their labels are copy. */
const DESTINATIONS = [
    { key: "tasks", href: "/tasks" },
    { key: "notifications", href: "/notify/preferences" },
    { key: "plan", href: "/plan/usage" },
    { key: "privacy", href: "/privacy" },
] as const

/** The policy routes every signed-in screen's footer names. */
const FOOTER_LINKS = [
    { key: "privacyPolicy", href: "/privacy-policy" },
    { key: "terms", href: "/terms" },
] as const

type DestinationLinksProps = {
  readonly copy: AccountShellCopy;
  readonly currentHref: string;
};

const DestinationLinks = (props: DestinationLinksProps) => (
    <>
        {DESTINATIONS.map(destination => (
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
  readonly copy: AccountShellCopy;
  readonly onSignOut: () => void;
};

const AccountPresence = (props: AccountPresenceProps) => (
    <div className={ACCOUNT_CLUSTER_CLASS_NAME}>
        <span aria-hidden="true" className={ACCOUNT_SHELL_AVATAR_CLASS_NAME}>
      A
        </span>
        <Text>{props.copy.accountName}</Text>
        <TextAction appearance="inline" onPress={props.onSignOut}>
            {props.copy.signOut}
        </TextAction>
    </div>
)

/**
 * The one signed-in workspace chrome: desktop header, compact header and navigation, the breadcrumb,
 * the screen's own content and the legal footer. `mainLandmark: "caller"` keeps the shell's neutral
 * primary div so the global `main { max-width: 32rem }` rule in globals.css never caps the readable
 * measure - the role="main" div below owns the landmark instead.
 */
export const AccountShell = (props: AccountShellProps) => {
    const copy = props.copy
    return (
        <WorkspaceShell
            mainLandmark="caller"
            header={
                <div className={ACCOUNT_SHELL_HEADER_BAR_CLASS_NAME}>
                    <PageContainer measure="product">
                        <div className={HEADER_ROW_CLASS_NAME}>
                            <div className={HEADER_BRAND_NAV_CLASS_NAME}>
                                <Text weight="semibold">{copy.brand}</Text>
                                <nav aria-label={copy.navLabel} className={HEADER_NAV_LIST_CLASS_NAME}>
                                    <DestinationLinks copy={copy} currentHref={props.currentHref} />
                                </nav>
                            </div>
                            <AccountPresence copy={copy} onSignOut={props.onSignOut} />
                        </div>
                    </PageContainer>
                </div>
            }
            compactHeader={
                <div className={COMPACT_HEADER_CLASS_NAME}>
                    <Text weight="semibold">{copy.brand}</Text>
                    <AccountPresence copy={copy} onSignOut={props.onSignOut} />
                </div>
            }
            compactNavigation={<DestinationLinks copy={copy} currentHref={props.currentHref} />}
            compactNavigationLabel={copy.navLabel}
            primary={
                <div role="main" aria-label={copy.mainLabel}>
                    <PageContainer measure="product">
                        <div className={PRIMARY_COLUMN_CLASS_NAME}>
                            <nav aria-label={copy.breadcrumbLabel}>
                                <Text size="sm" tone="muted">
                                    {copy.breadcrumb}
                                </Text>
                            </nav>
                            {props.children}
                            <footer className={FOOTER_ROW_CLASS_NAME}>
                                {FOOTER_LINKS.map(link => (
                                    <TextAction key={link.key} appearance="inline" href={link.href}>
                                        {copy.legal[link.key]}
                                    </TextAction>
                                ))}
                            </footer>
                        </div>
                    </PageContainer>
                </div>
            }
        />
    )
}
