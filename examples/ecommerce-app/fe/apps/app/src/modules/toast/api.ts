import type { GraphQLResponse } from "@ecommerce/api"
import { toast } from "./toast"

/** The localized labels of the toasts; the use*WithToast hooks resolve them from the catalog. */
export interface ToastMessages {
    readonly successTitle: string
    readonly errorTitle: string
    readonly unauthorizedTitle: string
    readonly unauthorizedDescription: string
    readonly defaultSuccess: string
    readonly defaultError: string
}

/** What a run*WithToast call takes besides the labels. */
export interface RunWithToastOptions {
    /** Toast a success too (default true); an error is always toasted. */
    readonly showSuccessToast?: boolean
    /** The success description instead of the default one. */
    readonly successMessage?: string
}

/** True when the failure is a refusal of the caller (kind `unauthenticated` or `forbidden`). */
const isRefusal = (kind: string): boolean => kind === "unauthenticated" || kind === "forbidden"

/** Toasts one GraphQLResponse: the success description, the refusal or the localized failure message. */
const showGraphQLToast = <T>(
    response: GraphQLResponse<T>,
    messages: ToastMessages,
    options: RunWithToastOptions = {},
): void => {
    if (response.success) {
        if (options.showSuccessToast !== false)
            toast.success(messages.successTitle, { description: options.successMessage ?? messages.defaultSuccess })
        return
    }
    if (isRefusal(response.kind)) {
        toast.danger(messages.unauthorizedTitle, { description: messages.unauthorizedDescription })
        return
    }
    toast.danger(messages.errorTitle, { description: response.message || messages.defaultError })
}

/** Runs one GraphQL operation and toasts its outcome; answers the response so the caller can branch on it. */
export const runGraphQLWithToast = async <T>(
    action: () => Promise<GraphQLResponse<T>>,
    messages: ToastMessages,
    options: RunWithToastOptions = {},
): Promise<GraphQLResponse<T>> => {
    const response = await action()
    showGraphQLToast(response, messages, options)
    return response
}
