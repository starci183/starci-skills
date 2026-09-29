import {
    Module 
} from "@nestjs/common"
import {
    StackModule 
} from "../../platform/stack/stack.module"
import {
    E2EGraphqlService 
} from "./e2e-graphql.service"

@Module({
    imports: [StackModule],
    providers: [E2EGraphqlService],
    exports: [E2EGraphqlService],
})
/**
 * The integrations layer's GraphQL capability: per-(service, user) ApolloClient instances
 * against each run-owned api's /graphql door. Depends on the stack module for the api addresses.
 */
export class E2EGraphqlModule {}
