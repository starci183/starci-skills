import useSWRMutation from "swr/mutation"
import { useSessionToken } from "@/hooks/auth"
import { setTaskComplete } from "@/modules/tasks"

type SetTaskCompleteMutationArg = { readonly arg: { readonly id: string; readonly complete: boolean } }

/** br.task.complete.once: completing twice is a no-op and reopening clears the timestamp; both are one call. */
export const useSetTaskComplete = () => {
    const token = useSessionToken()
    const setCompleteMutation = useSWRMutation(
        token ? (["tasks", token] as const) : null,
        ([, activeToken], { arg }: SetTaskCompleteMutationArg) => setTaskComplete(activeToken, arg.id, arg.complete),
    )
    return setCompleteMutation
}
