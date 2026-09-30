import { useState } from "react"
import { unsubscribeFromEmail } from "@/modules/notify"

/**
 * The derived unsubscribe-link screen's write lifecycle: it runs the backend's session-bound
 * `unsubscribe` mutation with the email link's `token` as the bearer credential (link token validation
 * and failure both stay on the backend contract - an absent, unknown or expired token is refused by the
 * backend) and settles on `unsubscribed` or `refused`. It never requires a stored sign-in: the link's
 * token IS the credential.
 *
 * @param token - The link's `token` query parameter, or null when the link carries none.
 */
export const useUnsubscribeLink = (token: string | null) => {
    const [state, setState] = useState<"idle" | "pending" | "unsubscribed" | "refused">("idle")

    const unsubscribe = async () => {
        if (token === null || token === "" || state === "pending" || state === "unsubscribed") return
        setState("pending")
        try {
            await unsubscribeFromEmail(token)
            setState("unsubscribed")
        } catch {
            setState("refused")
        }
    }

    return { state, unsubscribe }
}
