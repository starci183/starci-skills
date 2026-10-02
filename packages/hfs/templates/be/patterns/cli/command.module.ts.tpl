import { Module } from "@nestjs/common"
import { @@Action@@Handler } from "./application/@@action@@.handler"

@Module({ providers: [@@Action@@Handler] })
/** The @@command@@ command: the handler its cli entry dispatches to. */
export class @@Command@@Module {}
