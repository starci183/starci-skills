import { getTranslations } from "next-intl/server"
import { fetchCurrentUser } from "../../../modules/api/identity"
import { IDENTITY_API_URL } from "../../../modules/config"
import { SessionForm } from "../../blocks/SessionForm"
import { SignOutAction } from "../../blocks/SignOutAction"
import { AccountPageBase } from "./component"
import type { AccountPageState } from "./component"
import type { CurrentUser } from "../../../modules/api/identity"
import type { Result } from "../../../modules/api/result"

/** Props for the connected account page: the route mounts it empty and it reads its own world. */
export type AccountPageProps = Record<never, never>

/**
 * The screen situation an account read settles: the gate when no live session answers, the refusal
 * when the identity service cannot say, and - for a verified person - the buyer/non-buyer split the
 * account query's `hasOrders` flag is the whole of.
 */
const accountPageStateOf = (who: Result<CurrentUser | null>): AccountPageState => {
    if (!who.ok) return "unreachable"
    if (who.data === null) return "signedOut"
    return who.data.hasOrders ? "buyer" : "empty"
}

/**
 * The connected account page. The identity read happens here on the server - the session cookie's
 * bearer verified at `internal/sessions/verify`, then `account(personId)` for the person - and
 * every sentence resolves before the pure twin sees a prop. The signed-out surface mounts the
 * connected session form; the signed-in surface mounts the connected sign-out action beside the
 * title.
 */
export const AccountPage = async (props: AccountPageProps) => {
    void props
    const [t, who] = await Promise.all([
        getTranslations("shop.account"),
        fetchCurrentUser(),
    ])
    const accountLine = !who.ok
        ? t("unreachable", { url: IDENTITY_API_URL, reason: who.reason })
        : who.data === null
            ? t("anonymous")
            : t("signedInAs", { email: who.data.email })
    return (
        <AccountPageBase
            state={accountPageStateOf(who)}
            props={{
                title: t("title"),
                accountLine,
                authHeadline: t("auth.headline"),
                authLede: t("auth.lede"),
                authForm: <SessionForm />,
                signOut: <SignOutAction />,
                ordersTitle: t("ordersTitle"),
                ordersSignedOutTitle: t("ordersSignedOut.title"),
                ordersSignedOutDescription: t("ordersSignedOut.description"),
                ordersUnreachableTitle: t("ordersUnreachable.title"),
                ordersUnreachableDescription: who.ok
                    ? ""
                    : t("ordersUnreachable.description", { url: IDENTITY_API_URL, reason: who.reason }),
                ordersEmptyTitle: t("ordersEmpty.title"),
                ordersEmptyDescription: t("ordersEmpty.description"),
                ordersBuyerTitle: t("ordersBuyer.title"),
                ordersBuyerDescription: t("ordersBuyer.description"),
            }}
            on={{}}
        />
    )
}
