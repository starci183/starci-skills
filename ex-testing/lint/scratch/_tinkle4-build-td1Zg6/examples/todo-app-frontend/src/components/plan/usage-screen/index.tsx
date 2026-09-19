"use client"

import useSWR from "swr"
import useSWRMutation from "swr/mutation"
import { useTranslations } from "next-intl"
import { useSessionToken } from "@/hooks/auth"
import { signOut } from "@/modules/api/auth"
import { clearToken } from "@/modules/session"
import { readPlanUsage, startPlanCheckout } from "../api"
import { UsageScreenView, type UsageScreenViewState } from "./component"

/** PlanUsageScreen takes no external props; the query, the checkout mutation and the session are its own. */
export type PlanUsageScreenProps = Record<never, never>

/**
 * The connected owner of ui.plan.usage (the feature-entry and block halves this lane's write ceiling
 * folds into one owner): it owns the planUsage query and the upgradePlan mutation as world state,
 * resolves the one state UsageScreenView renders from the declared API shape - cap null is the paid
 * plan, a count above the cap is the frozen downgrade decision.plan.downgrade.policy chose - and
 * hands every render path to the pure UsageScreenView in ./component.tsx, which mounts GrammarRoot.
 * Every word that view draws - including the sentences that carry this reader's own numbers - is
 * resolved here from the `plan` and `shell` namespaces.
 */
export const PlanUsageScreen = (props: PlanUsageScreenProps) => {
    void props
    const t = useTranslations("plan")
    const tShell = useTranslations("shell")
    const token = useSessionToken()
    const usageQuery = useSWR(
        token ? (["plan-usage", token] as const) : null,
        ([, activeToken]) => readPlanUsage(activeToken),
    )
    const upgrade = useSWRMutation(
        token ? (["plan-upgrade", token] as const) : null,
        ([, activeToken]) => startPlanCheckout(activeToken),
    )

    const usage = usageQuery.data
    const state: UsageScreenViewState = !token || usageQuery.error
        ? "refused"
        : usage === undefined
            ? "loading"
            : usage.cap === null
                ? "paid-unlimited"
                : usage.activeCount > usage.cap
                    ? "over-cap-frozen"
                    : usage.activeCount === usage.cap
                        ? "at-cap"
                        : "under-cap"

    const onUpgrade = () => {
        void upgrade.trigger().then(checkout => {
            window.location.assign(checkout.checkoutUrl)
        }).catch(() => undefined)
    }

    const onSignOut = () => {
        if (token) void signOut(token)
        clearToken()
    }

    return (
        <UsageScreenView
            state={state}
            plan={usage?.plan ?? null}
            activeCount={usage?.activeCount ?? 0}
            cap={usage?.cap ?? null}
            readRefusal={usageQuery.error || !token ? t("sessionEnded") : null}
            upgradeRefusal={upgrade.error ? t("checkoutRefusal") : null}
            isUpgrading={upgrade.isMutating}
            copy={{
                brand: tShell("brand"),
                accountName: tShell("accountName"),
                signOut: tShell("signOut"),
                navLabel: tShell("navPrimaryDestinations"),
                destinations: {
                    tasks: tShell("destinations.tasks"),
                    notifications: tShell("destinations.notifications"),
                    plan: tShell("destinations.plan"),
                    privacy: tShell("destinations.privacy"),
                },
                legal: {
                    privacyPolicy: tShell("legal.privacyPolicy"),
                    terms: tShell("legal.terms"),
                },
                mainLabel: t("mainLabel"),
                breadcrumb: t("breadcrumb"),
                heading: t("heading"),
                usageCard: t("usageCard"),
                freePlan: t("freePlan"),
                paidPlan: t("paidPlan"),
                formatActiveTasks: (count: number) => t("activeTasks", { count }),
                formatFreePlanLimit: (cap: number) => t("freePlanLimit", { cap }),
                progressLabel: t("progressLabel"),
                formatPercentOfCap: (percent: number) => t("percentOfCap", { percent }),
                formatAtCap: (cap: number) => t("atCap", { cap }),
                formatOverCapCount: (count: number, cap: number) => t("overCapCount", { count, cap }),
                formatOverCapPaused: (cap: number) => t("overCapPaused", { cap }),
                overCapNote: t("overCapNote"),
                upgrade: t("upgrade"),
                manageTasks: t("manageTasks"),
                completeFreesSpace: t("completeFreesSpace"),
            }}
            onUpgrade={onUpgrade}
            onSignOut={onSignOut}
        />
    )
}
