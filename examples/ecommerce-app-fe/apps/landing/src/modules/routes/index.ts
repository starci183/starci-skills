/**
 * The landing site's internal destinations, owned in one place so a link never spells the same
 * path twice - internal navigation reads a named route, never a literal written at the call site.
 */
export const ROUTES: Readonly<Record<"home" | "catalogue" | "about", string>> = {
    home: "/",
    catalogue: "/#catalogue",
    about: "/#about",
}
