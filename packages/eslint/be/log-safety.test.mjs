import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { noSecretInError, noSecretInLog } from "./log-safety.mjs"

const tester = typedTester()
const SRC = at("src/modules/domain/order/order.service.ts")
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const PRELUDE = [
    'import type { Logger } from "@modules/platform/logging/logging.port"',
    'import type { Logger as Fake } from "@modules/domain/order/lookalike.service"',
    'import { Secret } from "@modules/platform/config/env-source.config"',
    'import type { Pii } from "@modules/domain/identity/identity.contracts"',
    'import { OrderLogEvent } from "@modules/domain/order/order.log-events"',
    "declare const logger: Logger",
    "declare const other: Fake",
    "declare const vault: Secret",
    "declare const holder: Pii<string>",
    "declare const cause: unknown",
].join("\n")
const withPrelude = (body) => `${PRELUDE}\n${body}`

test("no-secret-in-log: the Logger port takes no Secret or Pii value and no credential or personal name", () => {
    tester.run("no-secret-in-log", noSecretInLog, {
        valid: [
            { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { orderId, attempt: 2 })") },
            { filename: SRC, code: withPrelude("logger.error(OrderLogEvent.CheckoutFailed, cause, { orderId })") },
            // a name that measures a credential is not the credential
            { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { tokenCount: 3, tokenType: 'bearer', secretName: 'payos' })") },
            // masked forms and the length of a secret are shown, never the value
            { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { token: mask(token), key: hash(apiKey) })") },
            { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { configured: Boolean(vault) })") },
            // an event named after a credential flow is the event, not a value
            { filename: SRC, code: withPrelude("enum AuthEvent { PasswordResetTokenIssued = 'auth.password_reset.token_issued' }\nlogger.info(AuthEvent.PasswordResetTokenIssued, { userId })") },
            // a receiver that is not the Logger port is not judged here, whatever it is called
            { filename: SRC, code: withPrelude("other.info(`sent to ${email}`)\nconsole.log(password)\nservice.log({ password })") },
        ],
        invalid: [
            // by TYPE: the brand, whatever the value is called
            { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { k: vault })"), errors: [{ messageId: "secretType" }] },
            { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { k: holder })"), errors: [{ messageId: "piiType" }] },
            // read out of a brand
            { filename: SRC, code: withPrelude("logger.warn(OrderLogEvent.CheckoutRetried, { k: vault.value })"), errors: [{ messageId: "secretType" }] },
            // a renamed receiver and a property injection are still the Logger
            { filename: SRC, code: withPrelude("const sink = logger\nsink.info(OrderLogEvent.CheckoutRetried, { k: vault })"), errors: [{ messageId: "secretType" }] },
            { filename: SRC, code: withPrelude("class C { constructor(private readonly journal: Logger) {}\n run() { this.journal.error(OrderLogEvent.CheckoutFailed, cause, { k: vault }) } }"), errors: [{ messageId: "secretType" }] },
            // by NAME, for values that never carried a brand
            { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { password })"), errors: [{ messageId: "secret" }] },
            { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { auth: request.headers.authorization })"), errors: [{ messageId: "secret" }] },
            { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { accessToken })"), errors: [{ messageId: "secret" }] },
            { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { to: email })"), errors: [{ messageId: "pii" }] },
            { filename: SRC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { name: buyer.fullName })"), errors: [{ messageId: "pii" }] },
            // specs are not exempt
            { filename: SPEC, code: withPrelude("logger.info(OrderLogEvent.CheckoutRetried, { password })"), errors: [{ messageId: "secret" }] },
        ],
    })
})

const ERRORS = [
    'import { DomainError } from "@modules/platform/errors"',
    'import { Secret } from "@modules/platform/config/env-source.config"',
    "enum AccountErrorCode { InvalidPassword = 'INVALID_PASSWORD', TokenExpired = 'TOKEN_EXPIRED' }",
    "class AccountError extends DomainError<AccountErrorCode> { constructor(init: { code: AccountErrorCode; params?: Record<string, string>; cause?: unknown }) { super(init) } }",
    "declare const vault: Secret",
    "declare const accessToken: string",
    "declare const request: { headers: { authorization: string }; userId: string }",
    "declare const session: { token: string; tokenCount: number; accountId: string }",
    "declare function mask(value: string): string",
    "",
].join("\n")
const withErrors = (body) => `${ERRORS}${body}`

test("no-secret-in-error: a constructed error carries no Secret value and no text named like a credential", () => {
    tester.run("no-secret-in-error", noSecretInError, {
        valid: [
            // a code whose member name mentions a password is a code, not the password
            { filename: SRC, code: withErrors("throw new AccountError({ code: AccountErrorCode.InvalidPassword })") },
            { filename: SRC, code: withErrors("throw new AccountError({ code: AccountErrorCode.TokenExpired, params: { accountId: session.accountId } })") },
            // a count and a masked form are not the credential
            { filename: SRC, code: withErrors("throw new Error(`too many tokens: ${session.tokenCount}`)") },
            { filename: SRC, code: withErrors("throw new AccountError({ code: AccountErrorCode.TokenExpired, params: { token: mask(accessToken) } })") },
            // a personal identifier may name the refused account
            { filename: SRC, code: withErrors("declare const email: string\nthrow new AccountError({ code: AccountErrorCode.InvalidPassword, params: { email } })") },
            // a class that is not an error is not judged here
            { filename: SRC, code: withErrors("class Envelope { constructor(readonly token: string) {} }\nexport const e = new Envelope(accessToken)") },
        ],
        invalid: [
            // by TYPE: the Secret brand, or read out of it
            { filename: SRC, code: withErrors("throw new Error(`refused ${vault.reveal()}`)"), errors: [{ messageId: "secretType" }] },
            { filename: SRC, code: withErrors("throw new AccountError({ code: AccountErrorCode.TokenExpired, cause: vault })"), errors: [{ messageId: "secretType" }] },
            // by NAME, for text that never carried a brand
            { filename: SRC, code: withErrors("throw new Error(`token rejected: ${accessToken}`)"), errors: [{ messageId: "secret", data: { name: "accessToken" } }] },
            { filename: SRC, code: withErrors("throw new Error(request.headers.authorization)"), errors: [{ messageId: "secret" }] },
            { filename: SRC, code: withErrors("throw new AccountError({ code: AccountErrorCode.TokenExpired, params: { value: session.token } })"), errors: [{ messageId: "secret" }] },
            // the key a text value is given under names what it is
            { filename: SRC, code: withErrors("declare const raw: string\nthrow new AccountError({ code: AccountErrorCode.TokenExpired, params: { refreshToken: raw } })"), errors: [{ messageId: "secret", data: { name: "refreshToken" } }] },
            // specs are not exempt
            { filename: SPEC, code: withErrors("throw new Error(`token rejected: ${accessToken}`)"), errors: [{ messageId: "secret" }] },
        ],
    })
})
