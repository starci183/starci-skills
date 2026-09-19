import {
    Module 
} from "@nestjs/common"
import {
    E2EHttpModule 
} from "../../integrations/http/http.module"
import {
    E2EStackModule 
} from "../../platform/stack/stack.module"
import {
    E2EAuthService 
} from "./e2e-auth.service"

@Module({
    imports: [E2EStackModule,
        E2EHttpModule],
    providers: [E2EAuthService],
    exports: [E2EAuthService],
})
/**
 * The bussiness layer's accounts capability: register/signIn/revokeSession/deleteAccount through
 * the public doors plus realm-admin population management. Needs the stack (keycloak address,
 * admin credentials) and the http transport (public GraphQL door).
 */
export class E2EAccountsModule {}
