import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { WebhookSignatureService } from "@modules/platform/http-security"
import type { WebhookProviderOptions } from "@modules/platform/http-security"
import { InjectSepayOptions } from "./sepay.decorators"

@Injectable()
/** Configures the shared signature proof with the injected SePay provider options. */
export class SepaySignatureService extends WebhookSignatureService {
    constructor(@InjectSepayOptions() options: WebhookProviderOptions, @InjectClock() clock: Clock) {
        super(
            {
                allowedOrigins: [],
                rateLimit: { windowMs: 60_000, defaultLimit: 100, strictLimit: 100, serviceLimit: 100 },
                webhooks: { sepay: options },
            },
            clock,
        )
    }
}
