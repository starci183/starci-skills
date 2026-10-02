import { Module } from "@nestjs/common"
import { ExpireOverdueHandler } from "./application/expire-overdue.handler"
import { ExpireOverdueStep } from "./steps/expire-overdue.step"

@Module({ providers: [ExpireOverdueStep, ExpireOverdueHandler], exports: [ExpireOverdueStep] })
/** The application of the expire-orders job: the step and the handler it dispatches to; the queue transport module imports it. */
export class ExpireOrdersModule {}
