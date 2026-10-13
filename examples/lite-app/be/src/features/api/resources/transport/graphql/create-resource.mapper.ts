import type { CreateResourceResult } from "../../application/create-resource.contracts"
import type { CreateResourceType } from "./dto/create-resource.type"

/** Maps the result to the GraphQL type. */
export const toCreateResourceType = (result: CreateResourceResult): CreateResourceType => ({ id: result.id })
