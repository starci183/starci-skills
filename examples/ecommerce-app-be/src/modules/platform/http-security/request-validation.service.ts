import { Injectable, ValidationPipe } from "@nestjs/common"
import type { ValidationError } from "class-validator"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"

const fieldsOf = (errors: ReadonlyArray<ValidationError>): string => errors.map((error) => error.property).join(", ")

@Injectable()
/**
 * The global validation pipe: unknown properties are refused, values are transformed to their declared types, and a
 * failure is the capability error naming the offending fields (never Nest own bad-request exception).
 */
export class RequestValidationPipe extends ValidationPipe {
    constructor() {
        super({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: (errors: Array<ValidationError>) =>
                new HttpSecurityError({ code: HttpSecurityErrorCode.RequestInvalid, params: { fields: fieldsOf(errors) } }),
        })
    }
}
