/**
 * Twin tests for the infrastructure-owner law (R90 `BE_INFRA_OWNER`).
 *
 *   node --test infra-owner.test.mjs
 *
 * The table under test is the one the slot manifest ships (`ruleParams.be.infraOwners`); a case's path decides which
 * capability owns the file.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { at, fixtureHfs } from "./fixtures/typed/tester.mjs"
import { infraImportOwner, rules } from "./infra-owner.mjs"

const tester = new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
    settings: { starci: { hfs: fixtureHfs() } },
})

const HTTP = at("src/modules/platform/http/http.client.ts")
const RETRY = at("src/modules/platform/retry/retry.service.ts")
const MESSAGING = at("src/modules/platform/messaging/messaging.service.ts")
const SCHEDULING = at("src/modules/platform/scheduling/scheduling.service.ts")
const LOGGING = at("src/modules/platform/logging/logging.service.ts")
const CLOCK = at("src/modules/platform/clock/clock.service.ts")
const CACHE = at("src/modules/integrations/cache/cache.client.ts")
const REDIS = at("src/modules/integrations/redis/redis.client.ts")
const CONFIG = at("src/modules/platform/config/config.service.ts")
const DOMAIN = at("src/modules/domain/order/order.service.ts")
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const FEATURE = at("src/features/plan/application/place-order.handler.ts")
const INTEGRATION = at("src/modules/integrations/payos/payos.client.ts")
const E2E = at("src/tests/world/use-test-world.ts")

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("the table comes from the slot manifest and nothing else", () => {
    const table = fixtureHfs().ruleParams.infraOwners
    assert.deepEqual(table.fetch, ["platform/http"])
    assert.deepEqual(table["@nestjs/config"], [])
    const bare = new RuleTester({ languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" } })
    assert.throws(() => bare.run("infra-import-owner", infraImportOwner, { valid: [{ filename: DOMAIN, code: "export const a = 1" }], invalid: [] }), /settings\.starci\.hfs/)
})

test("infra-import-owner: each raw library is used only by its owner", () => {
    tester.run("infra-import-owner", infraImportOwner, {
        valid: [
            { filename: HTTP, code: `import axios from "axios"\nexport const get = () => axios.get("/")` },
            { filename: HTTP, code: `export const get = () => fetch("/")` },
            { filename: HTTP, code: `import { request } from "node:https"\nimport { request as plain } from "http"\nexport { request, plain }` },
            { filename: HTTP, code: `import got from "got"\nimport { fetch as pool } from "undici"\nexport { got, pool }` },
            { filename: HTTP, code: `export const wait = () => new Promise((resolve) => setTimeout(resolve, 5))` },
            { filename: RETRY, code: `import { setTimeout as sleep } from "node:timers/promises"\nexport const wait = () => sleep(5)` },
            { filename: RETRY, code: `export const wait = () => new Promise((resolve) => setTimeout(resolve, 5))` },
            { filename: MESSAGING, code: `import { Worker } from "bullmq"\nimport { Kafka } from "kafkajs"\nimport { BullModule } from "@nestjs/bullmq"\nexport { Worker, Kafka, BullModule }` },
            { filename: MESSAGING, code: `export const tick = () => setInterval(() => 1, 5)` },
            { filename: SCHEDULING, code: `import { ScheduleModule } from "@nestjs/schedule"\nexport { ScheduleModule }\nexport const t = setInterval(() => 1, 5)` },
            { filename: LOGGING, code: `import winston from "winston"\nexport { winston }` },
            { filename: CLOCK, code: `import dayjs from "dayjs"\nimport utc from "dayjs/plugin/utc"\nimport { toZonedTime } from "date-fns-tz"\nexport { dayjs, utc, toZonedTime }` },
            { filename: at("src/modules/platform/primitives/time.ts"), code: `import moment from "moment"\nexport { moment }` },
            { filename: CACHE, code: `import { caching } from "cache-manager"\nimport { createClient } from "redis"\nexport { caching, createClient }` },
            { filename: REDIS, code: `import Redis from "ioredis"\nexport { Redis }` },
            // the world's inlined helpers (slot be.tests.world.kit) belong to the same composition root: raw client, timers
            { filename: at("src/tests/world/kit/e2e-http-client.ts"), code: `import axios from "axios"
export { axios }` },
            { filename: at("src/tests/world/kit/poll.ts"), code: `export const wait = () => new Promise((resolve) => setTimeout(resolve, 5))` },
            // a local binding that shadows a global name is not the global
            { filename: DOMAIN, code: `export const f = (fetch: (x: string) => number) => fetch("a")` },
            { filename: DOMAIN, code: `const setTimeout = (fn: () => void) => fn()\nexport const g = () => setTimeout(() => 1)` },
            // a property called fetch is not the global
            { filename: DOMAIN, code: `export const h = (client: { fetch(): number }) => client.fetch()` },
            // libraries that are not in the table
            { filename: DOMAIN, code: `import { Module } from "@nestjs/common"\nimport { Cron } from "node-cron-lookalike"\nexport { Module, Cron }` },
        ],
        invalid: [
            { filename: DOMAIN, code: `import axios from "axios"\nexport { axios }`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `export const get = () => fetch("/")`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `export const get = () => globalThis.fetch("/")`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `export const wait = () => new Promise((resolve) => setTimeout(resolve, 5))`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `export const tick = () => setInterval(() => 1, 5)`, errors: [{ messageId: "foreign" }] },
            // a timer reached through the node module, renamed, or by its bare name
            { filename: DOMAIN, code: `import { setTimeout as wait } from "node:timers/promises"\nexport { wait }`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `import { setTimeout as wait } from "timers/promises"\nexport { wait }`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `import { default as got } from "got"\nexport { got }`, errors: [{ messageId: "foreign" }] },
            { filename: FEATURE, code: `import http from "node:http"\nexport { http }`, errors: [{ messageId: "foreign" }] },
            // dynamic import, require, re-export and a subpath
            { filename: DOMAIN, code: `export const load = () => import("axios")`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `const Redis = require("ioredis")\nexport { Redis }`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `export { caching } from "cache-manager"`, errors: [{ messageId: "foreign" }] },
            { filename: INTEGRATION, code: `import dayjs from "dayjs/plugin/utc"\nexport { dayjs }`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `import winston from "winston"\nexport { winston }`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `import { Worker } from "bullmq"\nexport { Worker }`, errors: [{ messageId: "foreign" }] },
            // another owner's library is not yours: http may not open a cache, cache may not queue
            { filename: HTTP, code: `import Redis from "ioredis"\nexport { Redis }`, errors: [{ messageId: "foreign" }] },
            { filename: CACHE, code: `import { Worker } from "bullmq"\nexport { Worker }`, errors: [{ messageId: "foreign" }] },
            { filename: INTEGRATION, code: `import { caching } from "cache-manager"\nexport { caching }`, errors: [{ messageId: "foreign" }] },
            // specs and the e2e lane are not exempt
            { filename: SPEC, code: `export const wait = () => new Promise((resolve) => setTimeout(resolve, 5))`, errors: [{ messageId: "foreign" }] },
            // a spec does not compose: it reaches infrastructure through useTestWorld, and a feature stays refused
            { filename: at("src/tests/e2e/flows/ping.e2e-spec.ts"), code: `export const ping = () => fetch("/health")`, errors: [{ messageId: "foreign" }] },
            { filename: at("src/tests/integration/plan/ping.integration-spec.ts"), code: `import axios from "axios"
export { axios }`, errors: [{ messageId: "foreign" }] },
            { filename: FEATURE, code: `export const ping = () => fetch("/health")`, errors: [{ messageId: "foreign" }] },
            // the world owns only what the table gives an owner: a library owned by nobody is refused there too
            { filename: E2E, code: `import "dotenv/config"`, errors: [{ messageId: "nowhere" }] },
            // the kit is not a way around the table: a library owned by nobody stays refused there
            { filename: at("src/tests/world/kit/env.ts"), code: `import "dotenv/config"`, errors: [{ messageId: "nowhere" }] },
            // nowhere: not even the capability that would seem to own it
            { filename: CONFIG, code: `import { ConfigModule } from "@nestjs/config"\nexport { ConfigModule }`, errors: [{ messageId: "nowhere" }] },
            { filename: CONFIG, code: `import "dotenv/config"`, errors: [{ messageId: "nowhere" }] },
            { filename: DOMAIN, code: `import { EventEmitter2 } from "@nestjs/event-emitter"\nexport { EventEmitter2 }`, errors: [{ messageId: "nowhere" }] },
        ],
    })
})
