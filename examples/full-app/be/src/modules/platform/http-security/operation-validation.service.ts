import type { Type } from "@nestjs/common"
import { RequestValidationService } from "./request-validation.service"

/**
 * The pipe of an operation route body. The body of the one operation route is typed `OperationRequest<Table>`, a type that
 * leaves no class at run time, so the global pipe finds nothing to validate. This pipe is given the class that mirrors the
 * envelope (`operation`, `requestId`, `input`) and validates the body against it with the same rules and the same refusal as
 * the global pipe.
 */
export class OperationValidationService extends RequestValidationService {
    constructor(envelope: Type<object>) {
        super()
        this.expectedType = envelope
    }
}
