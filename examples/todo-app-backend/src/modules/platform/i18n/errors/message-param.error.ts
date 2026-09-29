import {
    DomainError 
} from "@modules/platform/errors/index"

/** A message was read without a value for one of its named placeholders. */
export class MessageParamError extends DomainError {
    /** The message key that was read. */
    readonly key: string

    /** The placeholder that had no value. */
    readonly param: string

    constructor(key: string, param: string) {
        super("MESSAGE_PARAM_MISSING",
            `Message ${key} needs a value for {${param}}.`)
        this.key = key
        this.param = param
    }
}
