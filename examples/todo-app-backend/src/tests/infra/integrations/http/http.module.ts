import {
    Module 
} from "@nestjs/common"
import {
    E2EStackModule 
} from "../../platform/stack/stack.module"
import {
    E2EHttpService 
} from "./e2e-http.service"

@Module({
    imports: [E2EStackModule],
    providers: [E2EHttpService],
    exports: [E2EHttpService],
})
/**
 * The integrations layer's HTTP capability: axios-backed per-user clients against the run-owned
 * api (and any other run service by baseURL). Depends on the stack module for the api address.
 */
export class E2EHttpModule {}
