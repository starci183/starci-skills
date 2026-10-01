"use client"

import { useSessionForm } from "../../../hooks/session"
import { SessionFormBase } from "./component"

/** The connected form's state and actions are owned by its session hook. */
type SessionFormProps = Record<never, never>

/** Mounts the pure form with resolved session lifecycle and copy. */
export const SessionForm = (props: SessionFormProps) => {
    void props
    const model = useSessionForm()
    return <SessionFormBase {...model} />
}
