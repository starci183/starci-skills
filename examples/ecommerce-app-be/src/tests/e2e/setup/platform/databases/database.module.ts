import {
    Module 
} from "@nestjs/common"
import {
    StackModule 
} from "../stack/stack.module"
import {
    E2EDbService 
} from "./e2e-db.service"

@Module({
    imports: [StackModule],
    providers: [E2EDbService],
    exports: [E2EDbService],
})
/** The test-infra database platform module: E2EDbService, out-of-band persisted-state reads. */
export class DatabaseModule {}
