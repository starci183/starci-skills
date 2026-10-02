/**
 * The account view's layout roles: the signed-out surface's split (welcome panel left, form right -
 * the `auth-split` anatomy the ui.identity.sign-in direction fixes and never reverses) and the
 * orders block that reports its own situation beneath it.
 */
export const accountPageClassNames = {
    orders: "mt-8",
    authSplit: "mt-6 grid grid-cols-1 items-center gap-10 md:grid-cols-2",
    authIntro: "flex flex-col items-start gap-5 rounded-2xl bg-white p-8 dark:bg-neutral-900",
    authForm: "w-full",
} as const
