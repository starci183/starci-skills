import { useSessionToken } from "@/hooks/auth"
import { completeErasure, exportMyData, requestErasure } from "@/modules/privacy"

/**
 * ui.audit.privacy's two independent calls, bound to the reader's own session: `exportLines` reads the
 * caller's decrypted audit lines (fr.audit.export) and `erase` runs requestErasure then completeErasure
 * (fr.audit.erasure.request/complete), the two real mutations the backend serves. `signedIn` says
 * whether the session they need exists; a refused call rejects with the backend's stable code on `cause`.
 */
export const usePrivacyActions = () => {
    const token = useSessionToken()
    const exportLines = async () => {
        if (!token) throw new Error("No session")
        return exportMyData(token)
    }
    const erase = async (): Promise<void> => {
        if (!token) throw new Error("No session")
        const request = await requestErasure(token)
        await completeErasure(token, request.requestId)
    }
    return { signedIn: Boolean(token), exportLines, erase }
}
