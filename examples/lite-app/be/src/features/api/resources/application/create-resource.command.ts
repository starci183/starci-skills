import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateResourceRequest, CreateResourceResult } from "./create-resource.contracts"

/** Asks to create one resource row owned by the authenticated caller. */
export class CreateResourceCommand extends Command<CreateResourceResult> {
    constructor(readonly params: ExecuteParams<CreateResourceRequest>) {
        super()
    }
}
