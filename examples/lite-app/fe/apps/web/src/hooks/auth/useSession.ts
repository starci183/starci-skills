"use client"

import { useAppSelector } from "@/redux"
import type { SessionState } from "@/redux"

/** The reader's session as redux shares it (hooks/effects keeps it equal to modules/auth): unknown, signed in or signed out. */
export const useSession = (): SessionState => useAppSelector((state) => state.session)
