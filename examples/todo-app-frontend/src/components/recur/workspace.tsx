'use client';

import { useRouter } from 'next/navigation';
import { PageContainer, Text, TextAction, WorkspaceShell } from '@starci/grammar/common';
import { signOut } from '@/modules/api/auth';
import { ROUTES } from './routes';
import { clearToken } from '@/modules/session';
import { useSessionToken } from '@/hooks/auth';
import { Heading } from '@/components/leaves/Heading';
import { ScheduleBlock } from './schedule';
import {
  ACCOUNT_GROUP_CLASS_NAME,
  ACCOUNT_SEPARATOR_CLASS_NAME,
  AVATAR_CLASS_NAME,
  BRAND_CLASS_NAME,
  BREADCRUMB_CLASS_NAME,
  COMPACT_HEADER_INNER_CLASS_NAME,
  FOOTER_CLASS_NAME,
  HEADER_BAR_CLASS_NAME,
  HEADER_INNER_CLASS_NAME,
  INTRO_STACK_CLASS_NAME,
  LINK_UNDERLINE_CLASS_NAME,
  NAV_GROUP_CLASS_NAME,
  PAGE_STACK_CLASS_NAME,
  RECUR_SHELL_CLASS_NAME,
} from './classNames';

/**
 * The shared product shell ui.recur.schedule draws around the schedule card: a white desktop
 * header with the plain-text product name, the four destination labels and the synthetic Alex
 * account presence; Grammar's compactHeader/compactNavigation own the same furniture on narrow
 * viewports (recur.css hides the desktop band at the shell's own compact threshold).
 *
 * Destinations marked "direction route; not implemented here" on the record are still real
 * anchors - the record records them honestly and the screen mirrors them; it does not invent the
 * routes. Tasks is the one already-implemented destination, so it is also the current one.
 */
export type RecurWorkspaceProps = {
  readonly taskTitle: string | null;
};

const DESTINATIONS = [
  { label: 'Tasks', href: ROUTES.tasks, isCurrent: true },
  { label: 'Notifications', href: ROUTES.notifyPreferences, isCurrent: false },
  { label: 'Plan', href: ROUTES.planUsage, isCurrent: false },
  { label: 'Privacy', href: ROUTES.privacy, isCurrent: false },
] as const;

const DestinationRow = () => (
  <>
    {DESTINATIONS.map(destination => (
      <TextAction key={destination.href} appearance="tab" href={destination.href} isCurrent={destination.isCurrent}>
        {destination.label}
      </TextAction>
    ))}
  </>
);

/** The props of the account furniture: the sign-out command the header slot hands down. */
export type AccountPresenceProps = {
  readonly onSignOut: () => void;
};

/** The synthetic account furniture; the sign-out command itself is real. */
const AccountPresence = (props: AccountPresenceProps) => (
  <div className={ACCOUNT_GROUP_CLASS_NAME}>
    <span className={AVATAR_CLASS_NAME} aria-hidden="true">
      A
    </span>
    <Text>Alex</Text>
    <span className={ACCOUNT_SEPARATOR_CLASS_NAME} aria-hidden="true" />
    <span className={LINK_UNDERLINE_CLASS_NAME}>
      <TextAction appearance="inline" onPress={props.onSignOut}>
        Sign out
      </TextAction>
    </span>
  </div>
);

/** The product shell around the schedule screen: header, compact chrome, intro and footer. */
export const RecurWorkspace = (props: RecurWorkspaceProps) => {
  const router = useRouter();
  const token = useSessionToken();

  const onSignOut = () => {
    if (token !== null) void signOut(token);
    clearToken();
    router.push(ROUTES.signIn);
  };

  const header = (
    <div className={HEADER_BAR_CLASS_NAME}>
      <PageContainer measure="product" className={HEADER_INNER_CLASS_NAME}>
        <span className={BRAND_CLASS_NAME}>Todo app</span>
        <nav aria-label="Destinations" className={NAV_GROUP_CLASS_NAME}>
          <DestinationRow />
        </nav>
        <AccountPresence onSignOut={onSignOut} />
      </PageContainer>
    </div>
  );

  const compactHeader = (
    <div className={HEADER_BAR_CLASS_NAME}>
      <div className={COMPACT_HEADER_INNER_CLASS_NAME}>
        <span className={BRAND_CLASS_NAME}>Todo app</span>
        <AccountPresence onSignOut={onSignOut} />
      </div>
    </div>
  );

  const compactNavigation = <DestinationRow />;

  const primary = (
    <PageContainer measure="product" className={PAGE_STACK_CLASS_NAME}>
      <nav aria-label="Breadcrumb" className={BREADCRUMB_CLASS_NAME}>
        <span className={LINK_UNDERLINE_CLASS_NAME}>
          <TextAction appearance="inline" href={ROUTES.tasks}>
            Tasks
          </TextAction>
        </span>
        <Text as="span" tone="muted" aria-hidden="true">
          /
        </Text>
        {props.taskTitle === null ? null : (
          <>
            <Text as="span">{props.taskTitle}</Text>
            <Text as="span" tone="muted">
              /
            </Text>
          </>
        )}
        <Text as="span">Schedule</Text>
      </nav>
      <div className={INTRO_STACK_CLASS_NAME}>
        <Heading level={1}>Repeat this task</Heading>
        {props.taskTitle === null ? <Text tone="muted">No task selected.</Text> : <Text>{props.taskTitle}</Text>}
        <span className={LINK_UNDERLINE_CLASS_NAME}>
          <TextAction appearance="inline" href={ROUTES.tasks}>
            Back to task
          </TextAction>
        </span>
      </div>
      <ScheduleBlock taskTitle={props.taskTitle} />
      <footer className={FOOTER_CLASS_NAME}>
        <span className={LINK_UNDERLINE_CLASS_NAME}>
          <TextAction appearance="inline" href={ROUTES.privacyPolicy}>
            Privacy policy
          </TextAction>
        </span>
        <span className={LINK_UNDERLINE_CLASS_NAME}>
          <TextAction appearance="inline" href={ROUTES.terms}>
            Terms
          </TextAction>
        </span>
      </footer>
    </PageContainer>
  );

  return (
    <WorkspaceShell
      className={RECUR_SHELL_CLASS_NAME}
      header={header}
      compactHeader={compactHeader}
      compactNavigation={compactNavigation}
      compactNavigationLabel="Destinations"
      primary={primary}
      primaryLabel="A recurring task's schedule"
    />
  );
};
