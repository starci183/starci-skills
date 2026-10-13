import type { Create{{Singular}}Result } from "../../application/create-{{singular}}.contracts"
import type { Create{{Singular}}Type } from "./dto/create-{{singular}}.type"

/** Maps the result to the GraphQL type. */
export const toCreate{{Singular}}Type = (result: Create{{Singular}}Result): Create{{Singular}}Type => ({ id: result.id })
