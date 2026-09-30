import useSWRMutation from "swr/mutation"
import { useSessionToken } from "@/hooks/auth"
import { createTask } from "@/modules/tasks"

type CreateTaskMutationArg = { readonly arg: { readonly title: string } }

/** br.task.title.required is enforced server-side; this mutation only carries the trimmed title through. */
export const useCreateTask = () => {
    const token = useSessionToken()
    const createTaskMutation = useSWRMutation(
        token ? (["tasks", token] as const) : null,
        ([, activeToken], { arg }: CreateTaskMutationArg) => createTask(activeToken, arg.title),
    )
    return createTaskMutation
}
