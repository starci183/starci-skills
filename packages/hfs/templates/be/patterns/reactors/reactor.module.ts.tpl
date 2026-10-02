import { Module } from "@nestjs/common"
import { {{Action}}Handler } from "./application/{{action}}.handler"

@Module({ providers: [{{Action}}Handler] })
/** The {{reactor}} reactor: the handler its consumers dispatch to. */
export class {{Reactor}}Module {}
