"use client"

import { useSignOutAction } from "../../../hooks/session"
import { SignOutActionBase } from "./component"

/** The connected sign-out action takes no external inputs. */
type SignOutActionProps = Record<never, never>

/** Mounts the pure action with its resolved session lifecycle. */
export const SignOutAction = (props: SignOutActionProps) => {
    void props
    const model = useSignOutAction()
    return <SignOutActionBase {...model} />
}
