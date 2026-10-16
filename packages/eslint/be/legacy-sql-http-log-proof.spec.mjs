// proves: BE_SQL_INTERPOLATED@lite
// proves: BE_SQL_INTERPOLATED@full
// proves: BE_QUERY_UNBOUNDED@lite
// proves: BE_QUERY_UNBOUNDED@full
// proves: BE_HTTP_TIMEOUT@lite
// proves: BE_HTTP_TIMEOUT@full
// proves: BE_LOG_SECRET@lite
// proves: BE_LOG_SECRET@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { noSecretInError, noSecretInLog } from "./log-safety.mjs"
import { noInterpolatedSql, queryNeedsLimit } from "./query-safety.mjs"
import { httpNeedsTimeout } from "./resilience.mjs"

const HANDLER = at("src/features/api/checkout/application/place.handler.ts")
const SQL = at("src/modules/domain/order/persistence/order.sql.ts")
const CLIENT = at("src/modules/integrations/mailer/mail.client.ts")
const SERVICE = at("src/modules/domain/order/order.service.ts")

const QUERY = [
    'import { EntityManager } from "typeorm"',
    'import { ident, sql, type SqlText } from "@modules/platform/database/database.sql"',
    "declare class OrderEntity {}",
    "declare const manager: EntityManager",
    "declare const FIND_ORDERS: SqlText",
    "declare const owner: string",
    "const LIST_ROWS_MAX = 50",
    "",
].join("\n")
const query = (body) => QUERY + body

const HTTP = [
    'import axios from "axios"',
    'import { HttpService } from "@nestjs/axios"',
    "declare const url: string",
    "declare const body: object",
    "const TIMEOUT_MS = 1000",
    "",
].join("\n")
const http = (body) => HTTP + body

const LOG = [
    'import type { Logger } from "@modules/platform/logging/logging.port"',
    'import { Secret } from "@modules/platform/config/env-source.config"',
    'import type { Pii } from "@modules/domain/identity/identity.contracts"',
    'import { OrderLogEvent } from "@modules/domain/order/order.log-events"',
    "declare const logger: Logger",
    "declare const vault: Secret",
    "declare const holder: Pii<string>",
    "declare const password: string",
    "declare const email: string",
    "declare function mask(value: string): string",
    "",
].join("\n")
const log = (body) => LOG + body

const ERROR = [
    'import { Secret } from "@modules/platform/config/env-source.config"',
    "declare const vault: Secret",
    "declare const accessToken: string",
    "declare function mask(value: string): string",
    "",
].join("\n")
const error = (body) => ERROR + body

for (const edition of ["lite", "full"]) {
    const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)

    test(`R68 valid and invalid SQL substitutions in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("no-interpolated-sql", noInterpolatedSql, {
            valid: [
                { filename: SQL, code: query("export const FIND = sql`SELECT id FROM orders WHERE owner = $1`") },
                { filename: SQL, code: query("export const FIND = sql`SELECT ${ident('id', ['id'])} FROM orders`") },
                { filename: HANDLER, code: query("await manager.query(FIND_ORDERS, [owner])") },
            ],
            invalid: [
                { filename: SQL, code: query("export const FIND = sql`SELECT id FROM orders WHERE owner = '${owner}'`"), errors: [{ messageId: "substitution" }] },
                { filename: HANDLER, code: query("await manager.query(`SELECT id FROM orders WHERE owner = '${owner}'`)"), errors: [{ messageId: "built" }] },
                { filename: HANDLER, code: query("await manager.query('SELECT id FROM orders WHERE owner = ' + owner)"), errors: [{ messageId: "built" }] },
            ],
        })
    })

    test(`R69 valid and invalid bounded EntityManager reads in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("query-needs-limit", queryNeedsLimit, {
            valid: [
                { filename: HANDLER, code: query("await manager.find(OrderEntity, { where: { owner }, take: LIST_ROWS_MAX })") },
                { filename: HANDLER, code: query("await manager.findAndCount(OrderEntity, { take: LIST_ROWS_MAX, skip: 0 })") },
            ],
            invalid: [
                { filename: HANDLER, code: query("await manager.find(OrderEntity, { where: { owner } })"), errors: [{ messageId: "find" }] },
                { filename: HANDLER, code: query("await manager.findBy(OrderEntity, { owner })"), errors: [{ messageId: "findBy" }] },
                { filename: HANDLER, code: query("await manager.findAndCountBy(OrderEntity, { owner })"), errors: [{ messageId: "findBy" }] },
            ],
        })
    })

    test(`R70 valid and invalid outbound HTTP deadlines in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("http-needs-timeout", httpNeedsTimeout, {
            valid: [
                { filename: CLIENT, code: http("await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })") },
                { filename: CLIENT, code: http("await axios.get(url, { timeout: TIMEOUT_MS })") },
                { filename: CLIENT, code: http("class MailClient { constructor(private readonly client: HttpService) {} send() { return this.client.post(url, body, { timeout: TIMEOUT_MS }) } }") },
                { filename: CLIENT, code: http("export const client = axios.create({ timeout: TIMEOUT_MS })") },
            ],
            invalid: [
                { filename: CLIENT, code: http("await fetch(url)"), errors: [{ messageId: "fetchNoSignal" }] },
                { filename: CLIENT, code: http("await fetch(url, { signal: undefined })"), errors: [{ messageId: "fetchNoSignal" }] },
                { filename: CLIENT, code: http("await axios.post(url, body)"), errors: [{ messageId: "clientNoTimeout" }] },
                { filename: CLIENT, code: http("class MailClient { constructor(private readonly client: HttpService) {} send() { return this.client.get(url) } }"), errors: [{ messageId: "clientNoTimeout" }] },
                { filename: CLIENT, code: http("export const client = axios.create({ baseURL: url })"), errors: [{ messageId: "createNoTimeout" }] },
            ],
        })
    })

    test(`R71 valid and invalid Logger fields in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("no-secret-in-log", noSecretInLog, {
            valid: [
                { filename: SERVICE, code: log("logger.info(OrderLogEvent.CheckoutRetried, { tokenCount: 3, secretName: 'mailer' })") },
                { filename: SERVICE, code: log("logger.info(OrderLogEvent.CheckoutRetried, { password: mask(password) })") },
            ],
            invalid: [
                { filename: SERVICE, code: log("logger.info(OrderLogEvent.CheckoutRetried, { k: vault })"), errors: [{ messageId: "secretType" }] },
                { filename: SERVICE, code: log("logger.info(OrderLogEvent.CheckoutRetried, { k: holder })"), errors: [{ messageId: "piiType" }] },
                { filename: SERVICE, code: log("logger.info(OrderLogEvent.CheckoutRetried, { password })"), errors: [{ messageId: "secret" }] },
                { filename: SERVICE, code: log("logger.info(OrderLogEvent.CheckoutRetried, { to: email })"), errors: [{ messageId: "pii" }] },
            ],
        })
    })

    test(`R71 valid and invalid constructed error arguments in ${edition}`, () => {
        assert.equal(hfs.edition, edition)
        ruleTester({ root: TYPED_ROOT, hfs }).run("no-secret-in-error", noSecretInError, {
            valid: [
                { filename: SERVICE, code: error("throw new Error('checkout failed')") },
                { filename: SERVICE, code: error("throw new Error(mask(accessToken))") },
            ],
            invalid: [
                { filename: SERVICE, code: error("throw new Error(`refused ${vault.reveal()}`)"), errors: [{ messageId: "secretType" }] },
                { filename: SERVICE, code: error("throw new Error(accessToken)"), errors: [{ messageId: "secret" }] },
            ],
        })
    })
}
