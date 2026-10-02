import type { @@Action@@Request, @@Action@@Result } from "../../application/@@action@@.contracts"
import type { @@Action@@Input } from "./dto/@@action@@.input"
import type { @@Action@@Type } from "./dto/@@action@@.type"

/** Maps the GraphQL input to the command request. */
export const to@@Action@@Request = (input: @@Action@@Input): @@Action@@Request => ({ id: input.id })

/** Maps the result to the GraphQL type. */
export const to@@Action@@Type = (result: @@Action@@Result): @@Action@@Type => ({ id: result.id })
