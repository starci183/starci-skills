import {
    Module 
} from "@nestjs/common"
import {
    E2EStackModule 
} from "../../platform/stack/stack.module"
import {
    E2EGraphqlService 
} from "./e2e-graphql.service"

@Module({
    imports: [E2EStackModule],
    providers: [E2EGraphqlService],
    exports: [E2EGraphqlService],
})
/**
 * The integrations layer's GraphQL capability: per-user ApolloClient instances against the
 * run-owned api's /graphql door. Depends on the stack module for the api address.
 */
export class E2EGraphqlModule {}
