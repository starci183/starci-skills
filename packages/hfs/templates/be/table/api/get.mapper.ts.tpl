import type { Get{{Singular}}Request, Get{{Singular}}Result } from "../../application/get-{{singular}}.contracts"
import type { Get{{Singular}}Input } from "./dto/get-{{singular}}.input"
import type { Get{{Singular}}Type } from "./dto/get-{{singular}}.type"

/** Maps the GraphQL input to the query request. */
export const toGet{{Singular}}Request = (input: Get{{Singular}}Input): Get{{Singular}}Request => ({ id: input.id })

/** Maps the result to the GraphQL type. */
export const toGet{{Singular}}Type = (result: Get{{Singular}}Result): Get{{Singular}}Type => ({ id: result.id })
