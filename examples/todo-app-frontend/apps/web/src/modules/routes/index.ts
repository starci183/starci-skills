/**
 * The routed navigation owner: every internal destination the screens link to, named once.
 * Destinations the records mark "direction route; not implemented here" are still real paths - the
 * screens mirror them honestly without inventing their implementations.
 */
export const ROUTES = {
    tasks: "/tasks",
    recur: "/recur",
    notifyPreferences: "/notify/preferences",
    planUsage: "/plan/usage",
    privacy: "/audit/privacy",
    privacyPolicy: "/privacy-policy",
    terms: "/terms",
    signIn: "/sign-in",
    forgotPassword: "/forgot-password",
    createAccount: "/create-account",
} as const

/** The share screen of one task. */
export const taskShareHref = (taskId: string): string => `/tasks/${taskId}/share`

/** The recurrence screen for the task with this title: the backend identifies the task by its title. */
export const recurHref = (taskTitle: string): string => `${ROUTES.recur}?task=${encodeURIComponent(taskTitle)}`
