"use client"

import { useTranslations } from "next-intl"
import { useSignOut } from "@/hooks/auth"
import { usePlanUsage } from "@/hooks/plan"
import { useAccountShellCopy } from "@/hooks/shell"
import { UsageScreenView, type UsageScreenViewState } from "./component"

/** The usage numbers the state is read from; `cap` is null on the paid plan. */
type UsageReading = {
    readonly activeCount: number
    readonly cap: number | null
}

/** Which state the view renders: a refused read, a pending read, then where the count sits against the cap. */
const stateOf = (isRefused: boolean, usage: UsageReading | undefined): UsageScreenViewState => {
    if (isRefused) return "refused"
    if (usage === undefined) return "loading"
    if (usage.cap === null) return "paid-unlimited"
    if (usage.activeCount > usage.cap) return "over-cap-frozen"
    return usage.activeCount === usage.cap ? "at-cap" : "under-cap"
}

/** The usage screen takes nothing from its page: it owns its own session gate and usage read. */
type PlanUsageScreenProps = Record<never, never>

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
    const shellCopy = useAccountShellCopy("plan")
    const onSignOut = useSignOut()
    const { signedIn, usageQuery, upgrade } = usePlanUsage()

    const usage = usageQuery.data
    const isRefused = !signedIn || Boolean(usageQuery.error)
    const state = stateOf(isRefused, usage)

    const onUpgrade = () => {
        void upgrade.trigger(undefined, { throwOnError: false }).then((checkout) => {
            if (checkout !== undefined) window.location.assign(checkout.checkoutUrl)
        })
    }

    return (
        <UsageScreenView
            state={state}
            plan={usage?.plan ?? null}
            activeCount={usage?.activeCount ?? 0}
            cap={usage?.cap ?? null}
            readRefusal={isRefused ? t("sessionEnded") : null}
            upgradeRefusal={upgrade.error ? t("checkoutRefusal") : null}
            isUpgrading={upgrade.isMutating}
            copy={{
                ...shellCopy,
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
