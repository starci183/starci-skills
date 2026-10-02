import { useEffect } from "react"
import { createBrowserDbClient } from "@/modules/db/browser"
import { navigation } from "@/modules/i18n"

/** Refreshes server-rendered auth state after the browser client observes a session change. */
export const useAuthRefresh = (): void => {
    const router = navigation.useRouter()
    useEffect(() => {
        const listener = createBrowserDbClient().auth.onAuthStateChange(() => router.refresh())
        return () => listener.data.subscription.unsubscribe()
    }, [router])
}
