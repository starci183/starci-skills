import { GrammarRoot, Heading, PageContainer, Text, TextAction, WorkspaceShell } from "@starci/grammar/common"
import { TaskListBlock } from "@/components/blocks/task-list"
import {
    TASKS_ACCOUNT_CLASS_NAME,
    TASKS_AVATAR_CLASS_NAME,
    TASKS_COMPACT_HEADER_CLASS_NAME,
    TASKS_COMPACT_NAV_CLASS_NAME,
    TASKS_FOOTER_CLASS_NAME,
    TASKS_FOOTER_NAV_CLASS_NAME,
    TASKS_HEADER_CLASS_NAME,
    TASKS_HEADER_NAV_CLASS_NAME,
    TASKS_INTRO_CLASS_NAME,
    TASKS_MAIN_CLASS_NAME,
    TASKS_PAGE_CLASS_NAME,
} from "./classNames"

const DESTINATIONS = [
    { key: "tasks", href: "/tasks" },
    { key: "notifications", href: "/notify/preferences" },
    { key: "plan", href: "/plan/usage" },
    { key: "privacy", href: "/privacy" },
] as const

const FOOTER_LINKS = [
    { key: "privacyPolicy", href: "/privacy-policy" },
    { key: "terms", href: "/terms" },
] as const

type TasksPageCopy = {
    readonly brand: string
    readonly navPrimary: string
    readonly navLegal: string
    readonly accountName: string
    readonly signOut: string
    readonly destinations: Record<"tasks" | "notifications" | "plan" | "privacy", string>
    readonly legal: Record<"privacyPolicy" | "terms", string>
    readonly mainLabel: string
    readonly heading: string
    readonly tagline: string
}

type TasksPageBaseProps = {
    readonly copy: TasksPageCopy
    readonly onSignOut: () => void
}

type DestinationNavProps = {
    readonly size: "sm" | "md"
    readonly labels: TasksPageCopy["destinations"]
}

/** Draw the same four destinations at the size its shell slot supplies. */
const DestinationNav = ({ size, labels }: DestinationNavProps) => (
    <>
        {DESTINATIONS.map(destination => (
            <TextAction
                key={destination.href}
                appearance="tab"
                size={size}
                href={destination.href}
                isCurrent={destination.href === "/tasks"}
            >
                {labels[destination.key]}
            </TextAction>
        ))}
    </>
)

type AccountPresenceProps = {
    readonly copy: TasksPageCopy
    readonly onSignOut: () => void
}

/** Draw the account presence and its provided sign-out action. */
const AccountPresence = ({ copy, onSignOut }: AccountPresenceProps) => (
    <div className={TASKS_ACCOUNT_CLASS_NAME}>
        <span aria-hidden="true" className={TASKS_AVATAR_CLASS_NAME}>A</span>
        <Text as="span">{copy.accountName}</Text>
        <TextAction appearance="inline" onPress={onSignOut}>{copy.signOut}</TextAction>
    </div>
)

/** Draw the task shell from resolved copy and actions. */
export const TasksPageBase = ({ copy, onSignOut }: TasksPageBaseProps) => (
    <GrammarRoot>
        <WorkspaceShell
            mainLandmark="caller"
            header={
                <PageContainer className={TASKS_HEADER_CLASS_NAME}>
                    <Text as="span" weight="semibold">{copy.brand}</Text>
                    <nav aria-label={copy.navPrimary} className={TASKS_HEADER_NAV_CLASS_NAME}>
                        <DestinationNav size="md" labels={copy.destinations} />
                    </nav>
                    <AccountPresence copy={copy} onSignOut={onSignOut} />
                </PageContainer>
            }
            compactHeader={
                <PageContainer className={TASKS_COMPACT_HEADER_CLASS_NAME}>
                    <Text as="span" weight="semibold">{copy.brand}</Text>
                    <AccountPresence copy={copy} onSignOut={onSignOut} />
                </PageContainer>
            }
            compactNavigation={
                <div className={TASKS_COMPACT_NAV_CLASS_NAME}>
                    <DestinationNav size="sm" labels={copy.destinations} />
                </div>
            }
            compactNavigationLabel={copy.navPrimary}
            primary={
                <main aria-label={copy.mainLabel} className={TASKS_MAIN_CLASS_NAME}>
                    <PageContainer className={TASKS_PAGE_CLASS_NAME}>
                        <header className={TASKS_INTRO_CLASS_NAME}>
                            <Heading level={1} scale="display">{copy.heading}</Heading>
                            <Text tone="muted">{copy.tagline}</Text>
                        </header>
                        <TaskListBlock />
                        <footer className={TASKS_FOOTER_CLASS_NAME}>
                            <nav aria-label={copy.navLegal} className={TASKS_FOOTER_NAV_CLASS_NAME}>
                                {FOOTER_LINKS.map(link => (
                                    <TextAction key={link.href} appearance="inline" href={link.href}>
                                        {copy.legal[link.key]}
                                    </TextAction>
                                ))}
                            </nav>
                        </footer>
                    </PageContainer>
                </main>
            }
        />
    </GrammarRoot>
)