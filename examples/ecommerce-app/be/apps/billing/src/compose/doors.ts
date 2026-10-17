import type { DynamicModule, Type } from "@nestjs/common"
import { HealthHttpModule } from "@features/api/health"
import { InvoicingMessageModule } from "@features/api/invoicing"
import { BankTransferSettlementMessageModule } from "@features/reactors/bank-transfer-settlement"
import { SepayHttpModule } from "@features/webhooks/sepay"
import { IDENTITY_API } from "@modules/integrations/identity-api"
import { DatabaseProbe } from "@modules/platform/database"
import { EVENT_TRANSPORT } from "@modules/platform/event-bus"
import { ProbesModule } from "@modules/platform/probes"

/** Readiness, order-event consumption and the signed bank-transfer webhook door. */
export const doorsModules = (): Array<DynamicModule | Type<unknown>> => [
    ProbesModule.register({
        isGlobal: true,
        service: "billing",
        probes: [DatabaseProbe, IDENTITY_API, EVENT_TRANSPORT],
    }),
    HealthHttpModule.register({}),
    InvoicingMessageModule.register({}),
    SepayHttpModule.register({}),
    BankTransferSettlementMessageModule.register({}),
]
