import { useAppSelector } from "@/redux"

/** The reader's session as the app shares it: unknown until modules/auth answers, then signed in (with the person) or out. */
export const useSession = () => useAppSelector((state) => state.session)
