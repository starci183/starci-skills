import { Module } from "@nestjs/common"
import { {{Job}}Processor } from "./{{job}}.processor"
import { {{Step}}Step } from "./steps/{{step}}.step"

@Module({ providers: [{{Job}}Processor, {{Step}}Step] })
/** The {{job}} job: its processor and steps; a worker or api app imports it. */
export class {{Job}}Module {}
