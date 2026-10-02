import { Module } from "@nestjs/common"
import { @@Step@@Step } from "./steps/@@step@@.step"

@Module({ providers: [@@Step@@Step], exports: [@@Step@@Step] })
/** The application of the @@job@@ job: its steps; the queue transport module imports it. */
export class @@Job@@Module {}
