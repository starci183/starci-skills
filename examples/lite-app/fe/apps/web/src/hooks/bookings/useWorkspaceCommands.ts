"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useMutateCreateCalendarSwr, useMutateCreateResourceSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/** The outcome of a create command, as exposed by the workspace's SWR mutation. */
type CreateResponse = Awaited<ReturnType<ReturnType<typeof useMutateCreateResourceSwr>["trigger"]>>

/** One create command of the workspace: runs its SWR mutation through modules/toast and keeps the id it created. */
const useCreateCommand = (trigger: () => Promise<CreateResponse>, successMessage: string) => {
    const runGraphQL = useGraphQLWithToast()
    const [createdId, setCreatedId] = useState<string>()
    const create = useCallback(async () => {
        const response = await runGraphQL(trigger, { successMessage })
        if (response.success) setCreatedId(response.data.id)
    }, [runGraphQL, trigger, successMessage])
    return { create, createdId }
}

/**
 * The create commands of the booking workspace: a new resource and a new calendar of the signed-in reader, each through its
 * SWR mutation (hooks/swr) and reported by modules/toast.
 */
export const useWorkspaceCommands = () => {
    const t = useTranslations("app.workspace")
    const resourceMutation = useMutateCreateResourceSwr()
    const calendarMutation = useMutateCreateCalendarSwr()
    const resource = useCreateCommand(() => resourceMutation.trigger(), t("resourceCreated"))
    const calendar = useCreateCommand(() => calendarMutation.trigger(), t("calendarCreated"))
    return {
        resource: { ...resource, isCreating: resourceMutation.isMutating },
        calendar: { ...calendar, isCreating: calendarMutation.isMutating },
    }
}
