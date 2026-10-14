import { Controller, Get } from "@nestjs/common"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectReadiness } from "@modules/platform/http-security"
import type { ReadinessService } from "@modules/platform/http-security"

@Controller("health")
/** Readiness door: reports the bounded required-dependency probe, independently of process liveness. */
export class ReadyController {
    constructor(@InjectReadiness() private readonly readiness: ReadinessService) {}

    /** Answers 503 while the required primary database cannot serve the app. */
    @Get("ready")
    @Public({ reason: PublicReason.Health })
    ready(): Promise<{ readonly ok: true }> {
        return this.readiness.probeRequired()
    }
}
