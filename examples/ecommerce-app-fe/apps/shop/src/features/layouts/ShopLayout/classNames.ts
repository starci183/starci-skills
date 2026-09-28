/**
 * The shop chrome's visual roles: the page frame, the header bar, the wordmark link, the controls
 * cluster, the primary nav strip, and the routed body column every page renders into. The `dark:`
 * tokens pair with the class the shared theme provider paints on the root element.
 */
export const shopLayoutClassNames = {
    frame: "flex min-h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100",
    header: "border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
    bar: "mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-5",
    wordmark: "whitespace-nowrap text-base font-bold tracking-tight text-neutral-900 no-underline dark:text-neutral-100",
    controls: "flex items-center gap-3",
    nav: "flex items-center gap-1 overflow-x-auto text-sm",
    main: "mx-auto w-full max-w-5xl flex-1 px-5 py-7 pb-16",
} as const
