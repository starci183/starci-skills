import type { ClearCartResult } from "../../application/clear-cart.contracts"
import type { ClearCartType } from "./dto/clear-cart.type"

/** Maps the confirmation to the GraphQL type. */
export const toClearCartType = (result: ClearCartResult): ClearCartType => ({ cleared: result.cleared })
