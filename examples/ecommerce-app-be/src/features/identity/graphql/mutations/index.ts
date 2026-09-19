import {
    DynamicModule 
} from "@nestjs/common"
import {
    RegisterSingleMutationModule 
} from "./session/register/register.module"
import {
    SignInSingleMutationModule 
} from "./session/sign-in/sign-in.module"

/** Every GraphQL mutation module the identity API exposes, gathered exactly like
 * todo-app-backend's `mutations/index.ts` gathers `MUTATION_MODULES`. */
export const MUTATION_MODULES: Array<DynamicModule | (new () => unknown)> = [
    RegisterSingleMutationModule.register({
    }),
    SignInSingleMutationModule.register({
    }),
]
