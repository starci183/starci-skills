/** The one Outcome union of the fixture repository, so a case can compose it. */
export type Outcome<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly kind: "refused" | "invalid" | "not-found" | "unavailable" }
