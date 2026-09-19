import useSWRMutation from "swr/mutation"
import { useSessionToken } from "@/hooks/auth/useSessionToken"
import { createTaskAndNotify } from "@/modules/api/tasks"

type CreateTaskMutationArg = { readonly arg: { readonly title: string } };

/** br.task.title.required is enforced server-side; this mutation only carries the trimmed title through. */
export const useCreateTask = () => {
    const token = useSessionToken()
    const createTask = useSWRMutation(
        token ? (["tasks", token] as const) : null,
        ([, activeToken], { arg }: CreateTaskMutationArg) => createTaskAndNotify(activeToken, arg.title),
    )
    return createTask
}
