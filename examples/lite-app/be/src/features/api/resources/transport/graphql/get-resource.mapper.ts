import type { GetResourceRequest, GetResourceResult } from "../../application/get-resource.contracts"
import type { GetResourceInput } from "./dto/get-resource.input"
import type { GetResourceType } from "./dto/get-resource.type"

/** Maps the GraphQL input to the query request. */
export const toGetResourceRequest = (input: GetResourceInput): GetResourceRequest => ({ id: input.id })

/** Maps the result to the GraphQL type. */
export const toGetResourceType = (result: GetResourceResult): GetResourceType => ({ id: result.id })
