import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./upload.module-definition"
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
    UploadService 
} from "./upload.service"

/**
 * integration.upload.local: the upload capability, an integration-shaped module (client + contracts +
 * register()) because storage is an external-resource surface even when the adapter is the local
 * filesystem - the same reasoning that puts the redis queue under modules/integrations. The app
 * composition root registers it globally (`UploadModule.register({ isGlobal: true })` in
 * app.module.ts) because the feature's HTTP door resolves UploadService without importing this module
 * - the eslint no-non-global-module-import rule makes "import a capability module" illegal from a
 * feature module, so app-wide visibility is declared once, at the root, not smuggled per-consumer.
 */
@Module({
})
/** Nest module wiring the upload capability's providers; the app composition root registers it - other modules never import it. */
export class UploadModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                UploadService,
                {
                    provide: UploadStoragePort, useClass: LocalStorageAdapter 
                },
                {
                    provide: VirusScanPort, useClass: NoopVirusScanAdapter 
                }],
            exports: [UploadService],
        }
    }
}
