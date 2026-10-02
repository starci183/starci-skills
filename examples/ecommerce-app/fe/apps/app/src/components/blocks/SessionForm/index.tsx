"use client"

import { useSessionForm } from "../../../hooks/session"
import { SessionFormBase } from "./component"

/** Mounts the pure form with resolved session lifecycle and copy. */
export const SessionForm = () => {
    const model = useSessionForm()
    return <SessionFormBase {...model} />
}
