"use client"

import { GrammarRoot, Heading, PageContainer, Text, TextAction, WorkspaceShell } from "@starci/grammar/common"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { TaskListBlock } from "@/components/blocks/task-list"
import { useSessionToken } from "@/hooks/auth"
import { signOut } from "@/modules/api/auth"
import { clearToken } from "@/modules/session"
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

/**
 * The destinations ui.task.list's accepted shell names. Three of them are direction routes the record
 * itself marks "not implemented here"; the hrefs are still honest - they are the routes the sibling
 * feature records declare, and inventing a different target is what the direction forbids. The labels
 * are copy, so they arrive from the `shell` namespace by key.
 */
const DESTINATIONS = [
    { key: "tasks", href: "/tasks" },
    { key: "notifications", href: "/notify/preferences" },
    { key: "plan", href: "/plan/usage" },
    { key: "privacy", href: "/privacy" },
] as const

/** The legal destinations the same shell names in its footer. */
const FOOTER_LINKS = [
    { key: "privacyPolicy", href: "/privacy-policy" },
    { key: "terms", href: "/terms" },
] as const

/** The props of the destination row: the size the shell asks it to draw at. */
type DestinationNavProps = {
  readonly size: "sm" | "md";
};

/** The shell's destination row, with this screen marked current. */
const DestinationNav = (props: DestinationNavProps) => {
    const t = useTranslations("shell")
    return (
        <>
            {DESTINATIONS.map(destination => (
                <TextAction
                    key={destination.href}
                    appearance="tab"
                    size={props.size}
                    href={destination.href}
                    isCurrent={destination.href === "/tasks"}
                >
                    {t(`destinations.${destination.key}`)}
                </TextAction>
            ))}
        </>
    )
}

/** The props of the synthetic account presence. */
type AccountPresenceProps = {
  readonly onSignOut: () => void;
};

/** The synthetic account presence the accepted direction renders beside the destinations. */
const AccountPresence = (props: AccountPresenceProps) => {
    const t = useTranslations("shell")
    return (
        <div className={TASKS_ACCOUNT_CLASS_NAME}>
            <span aria-hidden="true" className={TASKS_AVATAR_CLASS_NAME}>
        A
            </span>
            <Text as="span">{t("accountName")}</Text>
            <TextAction appearance="inline" onPress={props.onSignOut}>
                {t("signOut")}
            </TextAction>
        </div>
    )
}

/**
 * The public entry of the task feature; the app route mounts exactly this and nothing else.
 *
 * Marked as a client boundary and wrapped in Grammar's own Common root: `@starci/grammar/common`
 * pulls in vendor client behavior (React Aria) that a Server Component cannot import, and the root
 * app layout stays a plain Server Component so it can keep exporting `metadata`.
 */
export const TasksPage = () => {
    const t = useTranslations("shell")
    const tTasks = useTranslations("tasks")
    const token = useSessionToken()
    const router = useRouter()

    /* Sign out ends the backend session best-effort; the local token is dropped first either way so a
   * network refusal can never leave the reader apparently signed in on their own screen. */
    const onSignOut = () => {
        clearToken()
        if (token) void signOut(token)
        router.push("/sign-in")
    }

    return (
        <GrammarRoot>
            <WorkspaceShell
                mainLandmark="caller"
                header={
                    <PageContainer className={TASKS_HEADER_CLASS_NAME}>
                        <Text as="span" weight="semibold">
                            {t("brand")}
                        </Text>
                        <nav aria-label={t("navPrimary")} className={TASKS_HEADER_NAV_CLASS_NAME}>
                            <DestinationNav size="md" />
                        </nav>
                        <AccountPresence onSignOut={onSignOut} />
                    </PageContainer>
                }
                compactHeader={
                    <PageContainer className={TASKS_COMPACT_HEADER_CLASS_NAME}>
                        <Text as="span" weight="semibold">
                            {t("brand")}
                        </Text>
                        <AccountPresence onSignOut={onSignOut} />
                    </PageContainer>
                }
                compactNavigation={<div className={TASKS_COMPACT_NAV_CLASS_NAME}><DestinationNav size="sm" /></div>}
                compactNavigationLabel={t("navPrimary")}
                primary={
                    <main aria-label={tTasks("mainLabel")} className={TASKS_MAIN_CLASS_NAME}>
                        <PageContainer className={TASKS_PAGE_CLASS_NAME}>
                            <header className={TASKS_INTRO_CLASS_NAME}>
                                <Heading level={1} scale="display">
                                    {tTasks("heading")}
                                </Heading>
                                <Text tone="muted">{tTasks("tagline")}</Text>
                            </header>
                            <TaskListBlock />
                            <footer className={TASKS_FOOTER_CLASS_NAME}>
                                <nav aria-label={t("navLegal")} className={TASKS_FOOTER_NAV_CLASS_NAME}>
                                    {FOOTER_LINKS.map(link => (
                                        <TextAction key={link.href} appearance="inline" href={link.href}>
                                            {t(`legal.${link.key}`)}
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
}
