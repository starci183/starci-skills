import { Button, GrammarRoot, Heading, PageContainer, Progress, SurfaceCard, Text, WorkspaceShell } from '@starci/grammar/common';
import { PlanRoutedAction } from '../routed-action';
import {
  PLAN_ACCOUNT_CLASS_NAME,
  PLAN_ACTIONS_CLASS_NAME,
  PLAN_AVATAR_CLASS_NAME,
  PLAN_COMPACT_HEADER_CLASS_NAME,
  PLAN_COMPACT_NAV_CLASS_NAME,
  PLAN_FOOTER_CLASS_NAME,
  PLAN_HEADER_CLASS_NAME,
  PLAN_HEADER_NAV_CLASS_NAME,
  PLAN_PRIMARY_CLASS_NAME,
  PLAN_PROGRESS_ROW_CLASS_NAME,
  PLAN_PROGRESS_TRACK_CLASS_NAME,
  PLAN_THEME_SCOPE_CLASS_NAME,
  PLAN_USAGE_BODY_CLASS_NAME,
} from './classNames';

/**
 * ui.plan.usage states: under-cap, at-cap, over-cap-frozen and paid-unlimited are the four the record
 * names; loading and refused are the two data-lifecycle states the planUsage read itself owns. The
 * connected owner in ./index.tsx resolves which state applies from the API result and hands it down
 * explicitly; this view never re-derives it.
 */
export type UsageScreenViewState = 'loading' | 'refused' | 'under-cap' | 'at-cap' | 'over-cap-frozen' | 'paid-unlimited';

/** The one beside-it inventory the UsageScreenViewState closed vocabulary is checked against. */
export const USAGE_SCREEN_VIEW_STATES: ReadonlyArray<UsageScreenViewState> = ['loading', 'refused', 'under-cap', 'at-cap', 'over-cap-frozen', 'paid-unlimited'] as const;

type Destination = { readonly label: string; readonly href: string };

/** The shell's four destinations, straight from ui.plan.usage's navigation/links inventory: /tasks is
 * the only route that exists today; the rest are direction routes the record declares honestly. */
const PRIMARY_DESTINATIONS: ReadonlyArray<Destination> = [
  { label: 'Tasks', href: '/tasks' },
  { label: 'Notifications', href: '/notify/preferences' },
  { label: 'Plan', href: '/plan/usage' },
  { label: 'Privacy', href: '/privacy' },
] as const;

/** The footer pair the direction shows: proposed policy routes, recorded as unimplemented upstream. */
const FOOTER_DESTINATIONS: ReadonlyArray<Destination> = [
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms' },
] as const;

/** The public props of the pure plan usage view. */
export type UsageScreenViewProps = {
  readonly state: UsageScreenViewState;
  readonly plan: string | null;
  readonly activeCount: number;
  readonly cap: number | null;
  readonly readRefusal: string | null;
  readonly upgradeRefusal: string | null;
  readonly isUpgrading: boolean;
  readonly onUpgrade: () => void;
  readonly onSignOut: () => void;
};

const destinationActions = (current: string) => PRIMARY_DESTINATIONS.map(destination => (
  <PlanRoutedAction
    key={destination.href}
    appearance="tab"
    route={destination.href}
    isCurrent={destination.href === current}
  >
    {destination.label}
  </PlanRoutedAction>
));

/** The pure render of ui.plan.usage: the workspace shell, the usage card and every named state. */
export const UsageScreenView = (props: UsageScreenViewProps) => {
  const state = props.state;
  const percentOfCap = props.cap !== null && props.cap > 0 ? Math.round((props.activeCount / props.cap) * 100) : 0;

  const header = (
    <div className={PLAN_HEADER_CLASS_NAME}>
      <Text weight="semibold" size="md">Todo app</Text>
      <nav aria-label="Primary destinations" className={PLAN_HEADER_NAV_CLASS_NAME}>
        {destinationActions('/plan/usage')}
      </nav>
      <div className={PLAN_ACCOUNT_CLASS_NAME}>
        <span aria-hidden="true" className={PLAN_AVATAR_CLASS_NAME}>A</span>
        <Text>Alex</Text>
        <PlanRoutedAction appearance="inline" route="/sign-in" onFollow={props.onSignOut}>Sign out</PlanRoutedAction>
      </div>
    </div>
  );

  const compactHeader = (
    <div className={PLAN_COMPACT_HEADER_CLASS_NAME}>
      <Text weight="semibold" size="md">Todo app</Text>
      <div className={PLAN_ACCOUNT_CLASS_NAME}>
        <Text>Alex</Text>
        <PlanRoutedAction appearance="inline" route="/sign-in" onFollow={props.onSignOut}>Sign out</PlanRoutedAction>
      </div>
    </div>
  );

  const compactNavigation = (
    <div className={PLAN_COMPACT_NAV_CLASS_NAME}>
      {destinationActions('/plan/usage')}
    </div>
  );

  return (
    <GrammarRoot className={PLAN_THEME_SCOPE_CLASS_NAME}>
    <WorkspaceShell
      primaryLabel="The usage screen and its upgrade action"
      header={header}
      compactHeader={compactHeader}
      compactNavigation={compactNavigation}
      compactNavigationLabel="Primary destinations"
      primary={(
        <PageContainer measure="product" className={PLAN_PRIMARY_CLASS_NAME}>
          <Text tone="muted" size="sm">Settings / Plan</Text>
          <Heading level={1} scale="display">Plan and usage</Heading>
          <SurfaceCard ariaLabel="Usage">
            <div data-state={state} className={PLAN_USAGE_BODY_CLASS_NAME}>
              {state === 'loading' ? (
                <>
                  <Text isSkeleton>Free plan</Text>
                  <Text size="metric-lead" weight="semibold" isSkeleton>0 active tasks</Text>
                  <Progress label="Tasks used against your free plan cap" isSkeleton />
                </>
              ) : null}
              {state === 'refused' ? (
                <Text live="assertive">{props.readRefusal}</Text>
              ) : null}
              {state !== 'loading' && state !== 'refused' ? (
                <>
                  <Text tone="muted">{props.plan === 'paid' ? 'Paid plan' : 'Free plan'}</Text>
                  <Text size="metric-lead" weight="semibold">{props.activeCount} active tasks</Text>
                  {state !== 'paid-unlimited' && props.cap !== null ? (
                    <>
                      <Text tone="muted">Free plan limit: {props.cap}</Text>
                      <div className={PLAN_PROGRESS_ROW_CLASS_NAME}>
                        <div className={PLAN_PROGRESS_TRACK_CLASS_NAME}>
                          <Progress label="Tasks used against your free plan cap" value={Math.min(100, percentOfCap)} />
                        </div>
                        <Text>{percentOfCap}% of cap</Text>
                      </div>
                    </>
                  ) : null}
                  {state === 'at-cap' ? (
                    <>
                      <Text live="polite">
                        You have used all {props.cap} active tasks on your free plan — the next task you try to create will be refused.
                      </Text>
                      <div className={PLAN_ACTIONS_CLASS_NAME}>
                        <Button variant="secondary" onPress={props.onUpgrade} isPending={props.isUpgrading}>
                          Upgrade plan
                        </Button>
                      </div>
                    </>
                  ) : null}
                  {state === 'over-cap-frozen' ? (
                    <>
                      <Text live="assertive">
                        You have {props.activeCount} active tasks, which exceeds your free plan limit of {props.cap}.
                      </Text>
                      <Text weight="semibold">Task creation is paused. Your free plan allows {props.cap} active tasks.</Text>
                      <Text>Your existing tasks are safe. Complete or delete tasks to make room, or upgrade for no task cap.</Text>
                      <div className={PLAN_ACTIONS_CLASS_NAME}>
                        <Button variant="primary" onPress={props.onUpgrade} isPending={props.isUpgrading}>
                          Upgrade plan
                        </Button>
                        <PlanRoutedAction appearance="inline" route="/tasks">Manage tasks</PlanRoutedAction>
                      </div>
                      <Text tone="muted">Completing tasks frees up space.</Text>
                    </>
                  ) : null}
                  {props.upgradeRefusal !== null ? (
                    <Text live="assertive">{props.upgradeRefusal}</Text>
                  ) : null}
                </>
              ) : null}
            </div>
          </SurfaceCard>
          <footer className={PLAN_FOOTER_CLASS_NAME}>
            {FOOTER_DESTINATIONS.map(destination => (
              <PlanRoutedAction key={destination.href} appearance="inline" route={destination.href}>
                {destination.label}
              </PlanRoutedAction>
            ))}
          </footer>
        </PageContainer>
      )}
    />
    </GrammarRoot>
  );
};
