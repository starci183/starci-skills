import { getTranslations } from "next-intl/server"
import type { Outcome } from "@ecommerce/api"
import type { Slot } from "@ecommerce/ui"
import { IDENTITY_API_URL } from "../../../modules/config"
import { fetchCurrentUser, type CurrentUser } from "../../../modules/services"
import { AccountPageBase } from "./component"
import type { AccountPageState } from "./component"

/**
 * The screen situation an account read settles: the gate when no live session answers, the refusal
 * when the identity service cannot say, and - for a verified person - the buyer/non-buyer split the
 * account query's `hasOrders` flag is the whole of.
 */
const accountPageStateOf = (who: Outcome<CurrentUser | null>): AccountPageState =>
    who.kind === "ok" && who.data === null ? "signedOut" : "account"

/** The one line under the title that says who is signed in, or why that cannot be said. */
const accountLineOf = (who: Outcome<CurrentUser | null>, t: Awaited<ReturnType<typeof getTranslations>>): string => {
    if (who.kind !== "ok") return t("unreachable", { url: IDENTITY_API_URL })
    return who.data === null ? t("anonymous") : t("signedInAs", { email: who.data.email })
}

/** Identity and order-history status for the page's one data slot. */
const ordersSlotOf = (who: Outcome<CurrentUser | null>): Slot<true> => {
    if (who.kind !== "ok" || who.data === null) return { status: "error" }
    return who.data.hasOrders ? { status: "ready", items: true } : { status: "empty" }
}

/**
 * The connected account page. The identity read happens here on the server - the session cookie's
 * bearer verified at `verifySession`, then `account` with that bearer for the person - and
 * every sentence resolves before the pure twin sees a prop. The signed-out surface mounts the
 * connected session form; the signed-in surface mounts the connected sign-out action beside the
 * title.
 */
export const AccountPage = async () => {
    const [t, who] = await Promise.all([getTranslations("shop.account"), fetchCurrentUser()])
    const accountLine = accountLineOf(who, t)
    return (
        <AccountPageBase
            state={accountPageStateOf(who)}
            props={{
                title: t("title"),
                accountLine,
                authHeadline: t("auth.headline"),
                authLede: t("auth.lede"),
                ordersTitle: t("ordersTitle"),
                ordersSignedOutTitle: t("ordersSignedOut.title"),
                ordersSignedOutDescription: t("ordersSignedOut.description"),
                ordersUnreachableTitle: t("ordersUnreachable.title"),
                ordersUnreachableDescription:
                    who.kind === "ok" ? "" : t("ordersUnreachable.description", { url: IDENTITY_API_URL }),
                ordersEmptyTitle: t("ordersEmpty.title"),
                ordersEmptyDescription: t("ordersEmpty.description"),
                ordersBuyerTitle: t("ordersBuyer.title"),
                ordersBuyerDescription: t("ordersBuyer.description"),
                ordersSlot: ordersSlotOf(who),
            }}
        />
    )
}
