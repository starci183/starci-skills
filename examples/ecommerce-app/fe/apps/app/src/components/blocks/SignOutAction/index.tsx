"use client"

import { useSignOutAction } from "../../../hooks/session"
import { SignOutActionBase } from "./component"

/** Mounts the pure action with its resolved session lifecycle. */
export const SignOutAction = () => {
    const model = useSignOutAction()
    return <SignOutActionBase {...model} />
}
