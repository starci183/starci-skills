import {
    Global, Module 
} from "@nestjs/common"
import {
    Test 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    LocalStorageAdapter 
} from "./local-storage.adapter"
import {
    NoopVirusScanAdapter 
} from "./noop-virus-scan.adapter"
import {
    UploadStoragePort, VirusScanPort 
} from "./upload.contracts"
import {
    UploadModule 
} from "./upload.module"
import {
    UploadService 
} from "./upload.service"

/** The globally-registered config + entity manager the register() graph resolves against in the real
 * app; stubs stand in for both here, the same seam integrations.modules.spec.ts stubs. */
@Global()
@Module({
    providers: [{
        provide: AppConfigService, useValue: {
            getUploadStorageDir: () => "unused-in-this-spec" 
        } 
    },
    {
        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: {
        } 
    }],
    exports: [AppConfigService,
        getEntityManagerToken(POSTGRESQL_PRIMARY)],
})
class TestGlobalsModule {}

describe("upload module wiring",
    () => {
        it("register() binds the service and both ports to the adapters the door injects",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [TestGlobalsModule,
                        UploadModule.register()],
                }).compile()
                try {
                    expect(moduleRef.get(UploadService)).toBeInstanceOf(UploadService)
                    expect(moduleRef.get(UploadStoragePort)).toBeInstanceOf(LocalStorageAdapter)
                    expect(moduleRef.get(VirusScanPort)).toBeInstanceOf(NoopVirusScanAdapter)
                } finally {
                    await moduleRef.close()
                }
            })
    })
