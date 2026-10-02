import { Module } from "@nestjs/common"
import { @@Queue@@Queue } from "./@@queue@@.queue"

@Module({ providers: [@@Queue@@Queue], exports: [@@Queue@@Queue] })
/** The @@queue@@ queue: its typed producer, imported by the domain module whose service enqueues. */
export class @@Queue@@Module {}
