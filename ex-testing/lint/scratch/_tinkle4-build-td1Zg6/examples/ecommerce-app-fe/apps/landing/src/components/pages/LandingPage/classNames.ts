/**
 * The landing page's visual roles: the page measure, the welcome hero, and the shared grid the
 * teaser and pillars sections both lay out on.
 */
export const landingPageClassNames = {
    page: "pb-20",
    hero: "flex flex-col items-center gap-6 pb-16 pt-20 text-center",
    heroCopy: "max-w-xl",
    heroActions: "mt-2 flex gap-3",
    section: "pb-16",
    grid: "mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",
} as const
