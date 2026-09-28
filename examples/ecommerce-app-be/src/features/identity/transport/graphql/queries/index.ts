import {
    DynamicModule 
} from "@nestjs/common"
import {
    AccountSingleQueryModule 
} from "./account/account/account.module"

/** Every GraphQL query module the identity API exposes, gathered exactly like
 * todo-app-backend's `queries/index.ts` gathers `QUERY_MODULES`. */
export const QUERY_MODULES: Array<DynamicModule | (new () => unknown)> = [
    AccountSingleQueryModule.register({
    }),
]
