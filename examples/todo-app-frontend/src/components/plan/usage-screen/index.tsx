'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSessionToken } from '@/hooks/auth';
import { signOut } from '@/modules/api/auth';
import { clearToken } from '@/modules/session';
import { readPlanUsage, startPlanCheckout } from '../api';
import { UsageScreenView, type UsageScreenViewState } from './component';

const READ_REFUSAL_MESSAGE = 'Your session has ended. Sign in again to see your plan usage.';
const CHECKOUT_REFUSAL_MESSAGE = 'Checkout could not be started. Try again from this page.';

/** PlanUsageScreen takes no external props; the query, the checkout mutation and the session are its own. */
export type PlanUsageScreenProps = {};

/**
 * The connected owner of ui.plan.usage (the feature-entry and block halves this lane's write ceiling
 * folds into one owner): it owns the planUsage query and the upgradePlan mutation as world state,
 * resolves the one state UsageScreenView renders from the declared API shape - cap null is the paid
 * plan, a count above the cap is the frozen downgrade decision.plan.downgrade.policy chose - and
 * hands every render path to the pure UsageScreenView in ./component.tsx, which mounts GrammarRoot.
 */
export const PlanUsageScreen = (props: PlanUsageScreenProps) => {
  const token = useSessionToken();
  const usageQuery = useSWR(
    token ? (['plan-usage', token] as const) : null,
    ([, activeToken]) => readPlanUsage(activeToken),
  );
  const upgrade = useSWRMutation(
    token ? (['plan-upgrade', token] as const) : null,
    ([, activeToken]) => startPlanCheckout(activeToken),
  );

  const usage = usageQuery.data;
  const state: UsageScreenViewState = !token || usageQuery.error
    ? 'refused'
    : usage === undefined
      ? 'loading'
      : usage.cap === null
        ? 'paid-unlimited'
        : usage.activeCount > usage.cap
          ? 'over-cap-frozen'
          : usage.activeCount === usage.cap
            ? 'at-cap'
            : 'under-cap';

  const onUpgrade = () => {
    void upgrade.trigger().then(checkout => {
      window.location.assign(checkout.checkoutUrl);
    }).catch(() => undefined);
  };

  const onSignOut = () => {
    if (token) void signOut(token);
    clearToken();
  };

  return (
    <UsageScreenView
      state={state}
      plan={usage?.plan ?? null}
      activeCount={usage?.activeCount ?? 0}
      cap={usage?.cap ?? null}
      readRefusal={usageQuery.error || !token ? READ_REFUSAL_MESSAGE : null}
      upgradeRefusal={upgrade.error ? CHECKOUT_REFUSAL_MESSAGE : null}
      isUpgrading={upgrade.isMutating}
      onUpgrade={onUpgrade}
      onSignOut={onSignOut}
    />
  );
};
