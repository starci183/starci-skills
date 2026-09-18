'use client';

import { GrammarRoot, Heading, PageContainer, Text, TextAction, WorkspaceShell } from '@starci/grammar/common';
import { useRouter } from 'next/navigation';
import { TaskListBlock } from '@/components/blocks/task-list';
import { useSessionToken } from '@/hooks/auth';
import { signOut } from '@/modules/api/auth';
import { clearToken } from '@/modules/session';
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
} from './classNames';

/**
 * The destinations ui.task.list's accepted shell names. Three of them are direction routes the record
 * itself marks "not implemented here"; the hrefs are still honest - they are the routes the sibling
 * feature records declare, and inventing a different target is what the direction forbids.
 */
const DESTINATIONS = [
  { label: 'Tasks', href: '/tasks' },
  { label: 'Notifications', href: '/notify/preferences' },
  { label: 'Plan', href: '/plan/usage' },
  { label: 'Privacy', href: '/privacy' },
] as const;

/** The legal destinations the same shell names in its footer. */
const FOOTER_LINKS = [
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms' },
] as const;

/** The props of the synthetic account presence. */
type AccountPresenceProps = {
  readonly onSignOut: () => void;
};

/** The synthetic account presence the accepted direction renders beside the destinations. */
const AccountPresence = ({ onSignOut }: AccountPresenceProps) => (
  <div className={TASKS_ACCOUNT_CLASS_NAME}>
    <span aria-hidden="true" className={TASKS_AVATAR_CLASS_NAME}>
      A
    </span>
    <Text as="span">Alex</Text>
    <TextAction appearance="inline" onPress={onSignOut}>
      Sign out
    </TextAction>
  </div>
);

/**
 * The public entry of the task feature; the app route mounts exactly this and nothing else.
 *
 * Marked as a client boundary and wrapped in Grammar's own Common root: `@starci/grammar/common`
 * pulls in vendor client behavior (React Aria) that a Server Component cannot import, and the root
 * app layout stays a plain Server Component so it can keep exporting `metadata`.
 */
export const TasksPage = () => {
  const token = useSessionToken();
  const router = useRouter();

  /* Sign out ends the backend session best-effort; the local token is dropped first either way so a
   * network refusal can never leave the reader apparently signed in on their own screen. */
  const onSignOut = () => {
    clearToken();
    if (token) void signOut(token);
    router.push('/sign-in');
  };

  const destinationNav = (size: 'sm' | 'md') => (
    <>
      {DESTINATIONS.map(destination => (
        <TextAction
          key={destination.href}
          appearance="tab"
          size={size}
          href={destination.href}
          isCurrent={destination.href === '/tasks'}
        >
          {destination.label}
        </TextAction>
      ))}
    </>
  );

  return (
    <GrammarRoot>
      <WorkspaceShell
        mainLandmark="caller"
        header={
          <PageContainer className={TASKS_HEADER_CLASS_NAME}>
            <Text as="span" weight="semibold">
              Todo app
            </Text>
            <nav aria-label="Primary" className={TASKS_HEADER_NAV_CLASS_NAME}>
              {destinationNav('md')}
            </nav>
            <AccountPresence onSignOut={onSignOut} />
          </PageContainer>
        }
        compactHeader={
          <PageContainer className={TASKS_COMPACT_HEADER_CLASS_NAME}>
            <Text as="span" weight="semibold">
              Todo app
            </Text>
            <AccountPresence onSignOut={onSignOut} />
          </PageContainer>
        }
        compactNavigation={<div className={TASKS_COMPACT_NAV_CLASS_NAME}>{destinationNav('sm')}</div>}
        compactNavigationLabel="Primary"
        primary={
          <main aria-label="The task list and its create form" className={TASKS_MAIN_CLASS_NAME}>
            <PageContainer className={TASKS_PAGE_CLASS_NAME}>
              <header className={TASKS_INTRO_CLASS_NAME}>
                <Heading level={1} scale="display">
                  Your tasks
                </Heading>
                <Text tone="muted">A little progress, every day.</Text>
              </header>
              <TaskListBlock />
              <footer className={TASKS_FOOTER_CLASS_NAME}>
                <nav aria-label="Legal" className={TASKS_FOOTER_NAV_CLASS_NAME}>
                  {FOOTER_LINKS.map(link => (
                    <TextAction key={link.href} appearance="inline" href={link.href}>
                      {link.label}
                    </TextAction>
                  ))}
                </nav>
              </footer>
            </PageContainer>
          </main>
        }
      />
    </GrammarRoot>
  );
};
