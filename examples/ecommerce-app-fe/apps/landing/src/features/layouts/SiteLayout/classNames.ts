/**
 * The site chrome's visual roles: the page frame, the header and footer bars that share one
 * centered measure, the wordmark link, and the section nav. The `dark:` tokens pair with the
 * class the shared theme provider paints on the root element.
 */
export const siteLayoutClassNames = {
    frame: "flex min-h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100",
    header: "border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
    bar: "mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5",
    wordmark: "text-lg font-bold tracking-tight text-neutral-900 no-underline dark:text-neutral-100",
    nav: "flex items-center gap-5 text-sm",
    main: "flex-1",
    footer: "mt-auto border-t border-neutral-200 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400",
} as const
