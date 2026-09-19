import { createNavigation } from "next-intl/navigation"
import type { ComponentType, ReactNode } from "react"

/**
 * NAVIGATION THAT KNOWS WHICH LANGUAGE THE READER IS IN.
 *
 * With the locale in the path, `push('/tasks')` has to mean `/vi/tasks` for a Vietnamese reader
 * and `/en/tasks` for an English one, and the difference cannot be left to each call site: one
 * forgotten prefix drops a reader out of their language mid-journey, and it is invisible until
 * somebody browsing in Vietnamese clicks that one link.
 *
 * So the prefixing happens once, through next-intl's `createNavigation` bound to the app's own
 * routing object. Call sites keep writing the locale-free path they always wrote and import these
 * helpers instead of `next/navigation`; a file still importing from `next/navigation` is a file
 * that was missed.
 */
/**
 * Bind next-intl's `createNavigation` to one app's routing object. Kept as a named kit function so
 * consumers reach for `fe-kit` names throughout their i18n module instead of mixing kit and vendor
 * imports for what is one act: "create my locale-aware navigation".
 *
 * @param routing - The routing object created from the app's i18n config.
 */
export const createI18nNavigation: typeof createNavigation = (routing) => createNavigation(routing)

/** The props a kit leaf needs from a created-navigation `Link`. */
export type FeKitLinkProps<L extends string = string> = {
    /** The locale-free destination the created Link re-prefixes. */
    readonly href: string;
    /** The locale the link switches to. */
    readonly locale?: L;
    /** Styling hook for the consuming leaf. */
    readonly className?: string;
    /** Current-locale marker the leaf sets on the reader's own language. */
    readonly "aria-current"?: "page" | "true" | "false" | boolean;
    /** The link's visible copy. */
    readonly children?: ReactNode;
};

/**
 * The pieces of a created navigation the kit's leaves consume. Each app creates its navigation
 * once (its own routing object) and hands the pieces to the leaf factories, so a leaf never
 * imports an app module and never falls back to `next/navigation` for a locale-aware hop.
 */
export type FeKitNavigation<L extends string = string> = {
    /** The locale-aware link created for the app's routing. */
    readonly Link: ComponentType<FeKitLinkProps<L>>;
    /** The locale-aware pathname reader: returns the path WITHOUT the locale segment. */
    readonly usePathname: () => string;
    /** The locale-aware router; `replace` accepts a `{ locale }` option to switch language in place. */
    readonly useRouter: () => { replace(href: string, options?: { locale?: L }): void };
};
