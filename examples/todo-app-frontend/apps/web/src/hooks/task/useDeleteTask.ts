import useSWRMutation from "swr/mutation"
import { useSessionToken } from "@/hooks/auth"
import { deleteTask } from "@/modules/tasks"

type DeleteTaskMutationArg = { readonly arg: { readonly id: string } }

/** br.task.delete.final: there is no undo, so the mutation never leaves a soft-deleted row behind. */
export const useDeleteTask = () => {
    const token = useSessionToken()
    const key = token ? (["tasks", token] as const) : null
    return useSWRMutation(key, ([, activeToken], { arg }: DeleteTaskMutationArg) => deleteTask(activeToken, arg.id))
}
