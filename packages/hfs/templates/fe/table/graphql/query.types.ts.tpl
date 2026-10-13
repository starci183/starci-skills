import type { {{Singular}}Query, {{Singular}}QueryVariables } from "../../__generated__/graphql"

/** What query{{Singular}} takes: the input of the `{{singularCamel}}` query (generated from the back end's contract). */
export type Query{{Singular}}Request = {{Singular}}QueryVariables["input"]

/** What query{{Singular}} answers: the `{{singularCamel}}` field. */
export type Query{{Singular}}Data = {{Singular}}Query["{{singularCamel}}"]
