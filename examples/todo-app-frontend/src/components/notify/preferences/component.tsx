import { Button, GrammarRoot, Heading, PageContainer, SurfaceCard, Text, TextAction, WorkspaceShell } from '@starci/grammar/common';
import {
  ACCOUNT_CLUSTER_CLASS_NAME,
  ACTION_ROW_CLASS_NAME,
  AVATAR_CLASS_NAME,
  COMPACT_HEADER_CLASS_NAME,
  FOOTER_ROW_CLASS_NAME,
  HEADER_BAR_CLASS_NAME,
  HEADER_BRAND_NAV_CLASS_NAME,
  HEADER_NAV_LIST_CLASS_NAME,
  HEADER_ROW_CLASS_NAME,
  HEADING_GROUP_CLASS_NAME,
  PRIMARY_COLUMN_CLASS_NAME,
  RULE_CLASS_NAME,
  TOGGLE_ROW_CLASS_NAME,
  UNSUBSCRIBE_GROUP_CLASS_NAME,
} from './classNames';

/** The closed ui.notify.preferences state vocabulary; the owner picks exactly one per render. */
export const NOTIFY_PREFERENCES_STATES = ['loading', 'subscribed', 'unsubscribed', 'saving', 'refused'] as const;

/** One member of the ui.notify.preferences state vocabulary. */
export type NotifyPreferencesState = (typeof NOTIFY_PREFERENCES_STATES)[number];

/** The view's complete contract: the resolved state, the displayed preference, the refusal
 * sentence when one applies, which write is pending, and the four user intents plus sign out. */
export interface NotifyPreferencesViewProps {
  readonly state: NotifyPreferencesState;
  /** The preference the toggle currently shows - the saved value, or the unsaved draft once the
   * owner flips it. `null` means the value has not loaded yet, so the control rests as a skeleton. */
  readonly subscribed: boolean | null;
  /** The refusal sentence the owner settled on; rendered only while `state` is `refused`. */
  readonly refusal: string | null;
  /** Which write is in flight. `save` drives the save Button's busy label and pending; `unsubscribe`
   * marks the unsubscribe text action pending. Either one disables every write control. */
  readonly pending: 'save' | 'unsubscribe' | null;
  readonly onToggle: () => void;
  readonly onSave: () => void;
  readonly onUnsubscribe: () => void;
  readonly onSignOut: () => void;
}

const CURRENT_DESTINATION = 'Notifications';

const DESTINATIONS = [
  { label: 'Tasks', href: '/tasks' },
  { label: 'Notifications', href: '/notify/preferences' },
  { label: 'Plan', href: '/plan/usage' },
  { label: 'Privacy', href: '/privacy' },
] as const;

const BACK_TO_TASKS = { label: 'Back to tasks', href: '/tasks' } as const;

const FOOTER_LINKS = [
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms' },
] as const;

const DestinationNav = () => (
  <nav aria-label="Primary" className={HEADER_NAV_LIST_CLASS_NAME}>
    {DESTINATIONS.map(destination => (
      <TextAction
        key={destination.label}
        appearance="tab"
        href={destination.href}
        isCurrent={destination.label === CURRENT_DESTINATION}
      >
        {destination.label}
      </TextAction>
    ))}
  </nav>
);

interface AccountPresenceProps {
  readonly onSignOut: () => void;
}

const AccountPresence = (props: AccountPresenceProps) => (
  <div className={ACCOUNT_CLUSTER_CLASS_NAME}>
    <span aria-hidden="true" className={AVATAR_CLASS_NAME}>
      A
    </span>
    <Text>Alex</Text>
    <TextAction appearance="inline" onPress={props.onSignOut}>
      Sign out
    </TextAction>
  </div>
);

/** The pure render of ui.notify.preferences; every one of its five states is decided by the
 * caller's `state` prop and stamped on the root as `data-state`. No hooks, no transport, no world
 * state. `mainLandmark: "caller"` keeps the shell's neutral primary div so the global
 * `main { max-width: 32rem }` rule in globals.css never caps the readable measure - the
 * role="main" div below owns the landmark instead. */
export const NotifyPreferencesView = (props: NotifyPreferencesViewProps) => {
  const { state, subscribed, refusal, pending } = props;
  const busy = pending !== null;

  return (
    <GrammarRoot data-state={state}>
      <WorkspaceShell
        mainLandmark="caller"
        header={
          <div className={HEADER_BAR_CLASS_NAME}>
            <PageContainer measure="product">
              <div className={HEADER_ROW_CLASS_NAME}>
                <div className={HEADER_BRAND_NAV_CLASS_NAME}>
                  <Text weight="semibold">Todo app</Text>
                  <DestinationNav />
                </div>
                <AccountPresence onSignOut={props.onSignOut} />
              </div>
            </PageContainer>
          </div>
        }
        compactHeader={
          <div className={COMPACT_HEADER_CLASS_NAME}>
            <Text weight="semibold">Todo app</Text>
            <AccountPresence onSignOut={props.onSignOut} />
          </div>
        }
        compactNavigation={
          <>
            {DESTINATIONS.map(destination => (
              <TextAction
                key={destination.label}
                appearance="tab"
                href={destination.href}
                isCurrent={destination.label === CURRENT_DESTINATION}
              >
                {destination.label}
              </TextAction>
            ))}
          </>
        }
        compactNavigationLabel="Primary"
        primary={
          <div role="main" aria-label="The notification preferences screen">
            <PageContainer measure="product">
              <div className={PRIMARY_COLUMN_CLASS_NAME}>
                <nav aria-label="Breadcrumb">
                  <Text size="sm" tone="muted">
                    Settings / Notifications
                  </Text>
                </nav>
                <div className={HEADING_GROUP_CLASS_NAME}>
                  <Heading level={1}>Notification preferences</Heading>
                  <Text tone="muted">Choose whether to receive task updates by email.</Text>
                </div>
                <SurfaceCard ariaLabel="Notification preferences">
                  <Heading level={2}>Email digest</Heading>
                  <Text tone="muted">Receive grouped task updates in your inbox.</Text>
                  {state === 'refused' && refusal !== null ? <Text live="assertive">{refusal}</Text> : null}
                  <div className={TOGGLE_ROW_CLASS_NAME}>
                    <Text weight="medium" isSkeleton={subscribed === null}>
                      {subscribed === false ? 'Off' : 'On'}
                    </Text>
                    <Button
                      variant={subscribed === false ? 'secondary' : 'primary'}
                      isDisabled={subscribed === null || busy}
                      isSkeleton={subscribed === null}
                      onPress={props.onToggle}
                    >
                      {subscribed === false ? 'Turn on' : 'Turn off'}
                    </Button>
                  </div>
                  {state === 'unsubscribed' ? (
                    <Text live="polite">You are unsubscribed from the email digest.</Text>
                  ) : null}
                </SurfaceCard>
                <div className={ACTION_ROW_CLASS_NAME}>
                  <Button
                    variant="primary"
                    isDisabled={subscribed === null || busy}
                    isPending={pending === 'save'}
                    onPress={props.onSave}
                  >
                    {pending === 'save' ? 'Saving…' : 'Save preferences'}
                  </Button>
                  <TextAction appearance="inline" href={BACK_TO_TASKS.href}>
                    {BACK_TO_TASKS.label}
                  </TextAction>
                </div>
                <div aria-hidden="true" className={RULE_CLASS_NAME} />
                <div className={UNSUBSCRIBE_GROUP_CLASS_NAME}>
                  <TextAction
                    appearance="inline"
                    isDisabled={busy}
                    isPending={pending === 'unsubscribe'}
                    onPress={props.onUnsubscribe}
                  >
                    Unsubscribe from email
                  </TextAction>
                  <Text size="sm" tone="muted">
                    You can also unsubscribe using the link in any email.
                  </Text>
                </div>
                <footer className={FOOTER_ROW_CLASS_NAME}>
                  {FOOTER_LINKS.map(link => (
                    <TextAction key={link.label} appearance="inline" href={link.href}>
                      {link.label}
                    </TextAction>
                  ))}
                </footer>
              </div>
            </PageContainer>
          </div>
        }
      />
    </GrammarRoot>
  );
};
