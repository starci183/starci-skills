import {
    Module 
} from "@nestjs/common"
import {
    E2EStackModule 
} from "../stack/stack.module"
import {
    E2EDbService 
} from "./e2e-db.service"

@Module({
    imports: [E2EStackModule],
    providers: [E2EDbService],
    exports: [E2EDbService],
})
/**
 * The platform layer's database capability: out-of-band DataSource access to the run-owned postgres
 * for seed/verify only. Depends on the stack module for the run-scoped DATABASE_URL.
 */
export class E2EDatabaseModule {}
