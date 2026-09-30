import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { noSecretInLog } from "./log-safety.mjs"

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
