import { Module } from "@nestjs/common"
import { @@Name@@Projection } from "./@@name@@.projection"

@Module({ providers: [@@Name@@Projection], exports: [@@Name@@Projection] })
/** The @@name@@ read model: its projection, called by a reactor or a job to recompute and by the api to read. */
export class @@Name@@Module {}
