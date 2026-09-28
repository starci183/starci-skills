import {
    Module 
} from "@nestjs/common"
import {
    StackModule 
} from "../../platform/stack/stack.module"
import {
    E2EHttpService 
} from "./e2e-http.service"

@Module({
    imports: [StackModule],
    providers: [E2EHttpService],
    exports: [E2EHttpService],
})
/** The test-infra http integration: E2EHttpService, the real-axios door clients. */
export class HttpModule {}
