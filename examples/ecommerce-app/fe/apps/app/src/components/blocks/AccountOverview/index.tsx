"use client"

import { useTranslations } from "next-intl"
import type { Slot } from "@ecommerce/ui"
import { useSessionForm } from "../../../hooks/rhf"
import { useSession, useSignOutAction } from "../../../hooks/session"
import { useQueryAccountSwr } from "../../../hooks/swr"
import { identityApiUrl } from "../../../modules/config"
import { AccountOverviewBase } from "./component"

/**
 * The connected account overview. The session lives in the browser (modules/auth); for a signed-in reader the identity
 * service's `account` query answers who they are and whether the order service knows them as a buyer. A signed-out
 * reader gets the sign-in split, a failed read the refusal naming the service's address, and every sentence resolves
 * before the pure twin sees a prop.
 */
export const AccountOverview = () => {
    const t = useTranslations("shop.account")
    const tLoading = useTranslations("shop.loading")
    const session = useSession()
    const account = useQueryAccountSwr()
    const sessionForm = useSessionForm()
    const signOut = useSignOutAction()
    const signedOut = session.status === "signed-out"
    const answer = account.data?.success ? account.data.data : null
    const failed = !signedOut && (account.error !== undefined || (account.data !== undefined && answer === null))
    let accountLine = ""
    if (signedOut) accountLine = t("anonymous")
    else if (answer !== null) accountLine = t("signedInAs", { email: answer.email })
    else if (failed) accountLine = t("unreachable", { url: identityApiUrl() })
    let ordersSlot: Slot<true> = { status: "loading" }
    if (answer !== null) ordersSlot = answer.hasOrders ? { status: "ready", items: true } : { status: "empty" }
    else if (failed) ordersSlot = { status: "error" }
    return (
        <AccountOverviewBase
            state={signedOut ? "signedOut" : "account"}
            props={{
                loadingLabel: tLoading("message"),
                title: t("title"),
                accountLine,
                authHeadline: t("auth.headline"),
                authLede: t("auth.lede"),
                ordersTitle: t("ordersTitle"),
                ordersSignedOutTitle: t("ordersSignedOut.title"),
                ordersSignedOutDescription: t("ordersSignedOut.description"),
                ordersUnreachableTitle: t("ordersUnreachable.title"),
                ordersUnreachableDescription: failed
                    ? t("ordersUnreachable.description", { url: identityApiUrl() })
                    : "",
                ordersEmptyTitle: t("ordersEmpty.title"),
                ordersEmptyDescription: t("ordersEmpty.description"),
                ordersBuyerTitle: t("ordersBuyer.title"),
                ordersBuyerDescription: t("ordersBuyer.description"),
                ordersSlot,
                sessionForm,
                signOutLabel: signOut.props.label,
                signingOut: signOut.state === "working",
            }}
            on={{ onSignOut: () => void signOut.on.onSignOut() }}
        />
    )
}
