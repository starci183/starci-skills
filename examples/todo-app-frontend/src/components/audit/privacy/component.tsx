import { Button, GrammarRoot, Heading, SurfaceCard, Text, TextAction, WorkspaceShell } from '@starci/grammar/common';
import {
  ACTION_ROW_CLASS_NAME,
  AVATAR_CLASS_NAME,
  COMPACT_ACCOUNT_CLASS_NAME,
  COMPACT_HEADER_CLASS_NAME,
  CONFIRM_ROW_CLASS_NAME,
  FACE_CLASS_NAME,
  FOOTER_ROW_CLASS_NAME,
  HEADER_ACCOUNT_CLASS_NAME,
  HEADER_BAR_CLASS_NAME,
  HEADER_BRAND_NAV_CLASS_NAME,
  HEADER_NAV_LIST_CLASS_NAME,
  HEADER_ROW_CLASS_NAME,
  PRIMARY_COLUMN_CLASS_NAME,
  RULE_CLASS_NAME,
} from './classNames';

/**
 * The pure render of ui.audit.privacy; every one of its six states is decided by the caller's
 * `state` prop and stamped on the root as `data-state`. No hooks, no transport, no world state.
 */

export const PRIVACY_STATES = [
  'idle',
  'exporting',
  'requesting-erasure',
  'erasure-pending',
  'erasure-complete',
  'erasure-refused',
] as const;

/** The closed ui.audit.privacy state vocabulary; the owner picks exactly one per render. */
export type PrivacyState = (typeof PRIVACY_STATES)[number];

/** The view's complete contract: one state, the refusal sentences, and the six user intents. */
export interface PrivacyViewProps {
  readonly state: PrivacyState;
  /** The refusal sentence the owner derived from the real failure; rendered only in erasure-refused. */
  readonly refusal: string | null;
  /** A failed export's own sentence; the export section reports it without leaving the idle state. */
  readonly exportRefusal: string | null;
  readonly onExport: () => void;
  readonly onRequestErasure: () => void;
  readonly onConfirmErasure: () => void;
  readonly onCancelErasure: () => void;
  readonly onSignOut: () => void;
}

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

interface AccountPresenceProps {
  readonly onSignOut: () => void;
}

const DestinationNav = () => (
  <nav aria-label="Primary" className={HEADER_NAV_LIST_CLASS_NAME}>
    {DESTINATIONS.map(destination => (
      <TextAction
        key={destination.label}
        appearance="tab"
        href={destination.href}
        isCurrent={destination.label === 'Privacy'}
      >
        {destination.label}
      </TextAction>
    ))}
  </nav>
);

const AccountPresence = ({ onSignOut }: AccountPresenceProps) => (
  <div className={HEADER_ACCOUNT_CLASS_NAME}>
    <span aria-hidden="true" className={AVATAR_CLASS_NAME}>
      A
    </span>
    <Text>Alex</Text>
    <TextAction appearance="inline" onPress={onSignOut}>
      Sign out
    </TextAction>
  </div>
);

/** Pure view for the privacy screen: renders the workspace shell and every mapped privacy state. */
export const PrivacyView = (props: PrivacyViewProps) => {
  const { state, refusal, exportRefusal } = props;
  const erasureBusy = state === 'erasure-pending';
  const complete = state === 'erasure-complete';

  return (
    <GrammarRoot data-state={state}>
      <WorkspaceShell
        mainLandmark="caller"
        header={
          <div className={HEADER_BAR_CLASS_NAME}>
            <div className={HEADER_ROW_CLASS_NAME}>
              <div className={HEADER_BRAND_NAV_CLASS_NAME}>
                <Text weight="semibold">Todo app</Text>
                <DestinationNav />
              </div>
              <AccountPresence onSignOut={props.onSignOut} />
            </div>
          </div>
        }
        compactHeader={
          <div className={COMPACT_HEADER_CLASS_NAME}>
            <Text weight="semibold">Todo app</Text>
            <div className={COMPACT_ACCOUNT_CLASS_NAME}>
              <span aria-hidden="true" className={AVATAR_CLASS_NAME}>
                A
              </span>
              <Text>Alex</Text>
              <TextAction appearance="inline" onPress={props.onSignOut}>
                Sign out
              </TextAction>
            </div>
          </div>
        }
        compactNavigation={
          <>
            {DESTINATIONS.map(destination => (
              <TextAction
                key={destination.label}
                appearance="tab"
                href={destination.href}
                isCurrent={destination.label === 'Privacy'}
              >
                {destination.label}
              </TextAction>
            ))}
          </>
        }
        compactNavigationLabel="Primary"
        primary={
          <div aria-label="The privacy screen - request erasure, export data" className={PRIMARY_COLUMN_CLASS_NAME} role="main">
            <nav aria-label="Breadcrumb">
              <Text size="sm" tone="muted">
                Settings / Privacy
              </Text>
            </nav>
            <div>
              <Heading level={1} scale="display">Privacy and your data</Heading>
              <Text tone="muted">Manage the data linked to your account.</Text>
            </div>
            <SurfaceCard ariaLabel="Privacy" composition="joined" frame="frameless">
              <section aria-label="Export your data" className={FACE_CLASS_NAME}>
                <Heading level={2}>Export your data</Heading>
                <Text tone="muted">Get a copy of your personal activity records.</Text>
                {complete ? null : (
                  <div className={ACTION_ROW_CLASS_NAME}>
                    <Button
                      isDisabled={erasureBusy}
                      isPending={state === 'exporting'}
                      onPress={props.onExport}
                      variant="secondary"
                    >
                      {state === 'exporting' ? 'Exporting…' : 'Export my data'}
                    </Button>
                  </div>
                )}
                {exportRefusal === null ? null : (
                  <Text live="assertive">{exportRefusal}</Text>
                )}
              </section>
              <div aria-hidden="true" className={RULE_CLASS_NAME} />
              <section aria-label="Request erasure" className={FACE_CLASS_NAME}>
                <Heading level={2}>Request erasure</Heading>
                <Text tone="muted">
                  Remove information that identifies you from the activity log. This cannot be undone
                  once completed.
                </Text>
                {state === 'erasure-refused' && refusal !== null ? (
                  <Text live="assertive">{refusal}</Text>
                ) : null}
                {complete ? (
                  <Text live="polite">
                    Your erasure request is complete. Information that identifies you has been removed
                    from the activity log.
                  </Text>
                ) : state === 'requesting-erasure' ? (
                  <div className={CONFIRM_ROW_CLASS_NAME}>
                    <Button onPress={props.onConfirmErasure} variant="outline">
                      Confirm erasure
                    </Button>
                    <Button onPress={props.onCancelErasure} variant="ghost">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    {erasureBusy ? (
                      <Text live="polite" tone="muted">
                        Submitting your erasure request…
                      </Text>
                    ) : null}
                    <div className={ACTION_ROW_CLASS_NAME}>
                      <Button
                        isDisabled={erasureBusy}
                        onPress={props.onRequestErasure}
                        variant="outline"
                      >
                        Request erasure
                      </Button>
                      <TextAction appearance="inline" href={BACK_TO_TASKS.href}>
                        {BACK_TO_TASKS.label}
                      </TextAction>
                    </div>
                  </>
                )}
              </section>
            </SurfaceCard>
            <div aria-hidden="true" className={RULE_CLASS_NAME} />
            <footer className={FOOTER_ROW_CLASS_NAME}>
              {FOOTER_LINKS.map(link => (
                <TextAction key={link.label} appearance="inline" href={link.href}>
                  {link.label}
                </TextAction>
              ))}
            </footer>
          </div>
        }
      />
    </GrammarRoot>
  );
};
