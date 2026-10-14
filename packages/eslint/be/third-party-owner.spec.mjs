// proves: BE_THIRD_PARTY_OWNER@lite
// proves: BE_THIRD_PARTY_OWNER@full
/** R279: every declared SDK has one integration owner in both editions; pure libraries remain usable in domain logic. */
import assert from "node:assert/strict"
import test from "node:test"
import { Linter } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { infraImportOwner } from "./infra-owner.mjs"
import { recommended, rules, thirdPartyImportOwner } from "./third-party-owner.mjs"

const DOMAIN = "src/modules/domain/order/order.service.ts"
const MAILER = "src/modules/integrations/mailer/mailer.client.ts"
const OTHER = "src/modules/integrations/other/other.client.ts"
const DEPENDENCIES = {
    nodemailer: "1.0.0", openai: "1.0.0", googleapis: "1.0.0", "@new-vendor/io-sdk": "1.0.0",
    "class-validator": "1.0.0", rxjs: "1.0.0", "@nestjs/common": "1.0.0", "@nestjs/core": "1.0.0", typeorm: "1.0.0",
    axios: "1.0.0", bullmq: "1.0.0", dotenv: "1.0.0", "@supabase/supabase-js": "1.0.0", jose: "1.0.0",
}

const fixtureFor = ({ edition, files = {}, manifest = {} }) => projectFixture({
    edition,
    files,
    rootFiles: { "package.json": JSON.stringify({ name: "sdk-owner-fixture", private: true, dependencies: DEPENDENCIES, ...manifest }) },
})

test("R279 publishes exactly one rule at error", () => {
    assert.deepEqual(rules, { "third-party-import-owner": thirdPartyImportOwner })
    assert.deepEqual(recommended, { "starci-be/third-party-import-owner": "error" })
})

for (const edition of ["lite", "full"]) {
    test(`R279 ${edition}: declared SDKs cannot be imported outside an integration; pure libraries pass`, () => {
        const fixture = fixtureFor({ edition })
        try {
            fixture.tester.run("third-party-import-owner", thirdPartyImportOwner, {
                valid: [
                    { filename: fixture.at(DOMAIN), code: 'import { IsString } from "class-validator"; import { map } from "rxjs/operators"; export { IsString, map }' },
                    { filename: fixture.at(DOMAIN), code: 'import { Injectable } from "@nestjs/common"; import type { EntityManager } from "typeorm"; export { Injectable }; export type { EntityManager }' },
                    { filename: fixture.at(DOMAIN), code: 'import type { Mail } from "@modules/integrations/mailer"; import { helper } from "./order.policy"; export { helper }; export type { Mail }' },
                    { filename: fixture.at(DOMAIN), code: 'import { randomUUID } from "node:crypto"; export { randomUUID }' },
                    { filename: fixture.at("apps/core/src/main.ts"), code: 'import { NestFactory } from "@nestjs/core"; export { NestFactory }' },
                    // The existing infrastructure table is judged by R90, including its nowhere entries.
                    { filename: fixture.at(DOMAIN), code: 'import axios from "axios"; import "dotenv/config"; import { Queue } from "bullmq"; export { axios, Queue }' },
                ],
                invalid: [
                    { filename: fixture.at(DOMAIN), code: 'import mail from "nodemailer"; export { mail }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at(DOMAIN), code: 'import OpenAI from "openai"; export { OpenAI }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at(DOMAIN), code: 'import { google } from "googleapis"; export { google }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at(DOMAIN), code: 'export const load = () => import("openai/resources/chat")', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at(DOMAIN), code: 'const sdk = require("@new-vendor/io-sdk/client"); export { sdk }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at(DOMAIN), code: 'import sdk = require("googleapis"); export { sdk }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at(DOMAIN), code: 'export * from "openai"', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at(DOMAIN), code: 'import type { Client } from "@new-vendor/io-sdk"; export type { Client }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at("src/features/api/order/application/send.handler.ts"), code: 'export { default as mail } from "nodemailer"', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at("src/modules/platform/http/http.client.ts"), code: 'import sdk from "openai"; export { sdk }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at("src/modules/domain/order/order.service.spec.ts"), code: 'import sdk from "openai"; export { sdk }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at("apps/core/src/main.ts"), code: 'import sdk from "@new-vendor/io-sdk"; export { sdk }', errors: [{ messageId: "foreign" }] },
                ],
            })
        } finally { fixture.cleanup() }
    })

    test(`R279 ${edition}: one provider can use the SDK in multiple files, including its tests`, () => {
        const fixture = fixtureFor({ edition, files: {
            [MAILER]: 'import mail from "nodemailer"; export { mail }',
            "src/modules/integrations/mailer/mail.model.ts": 'export type { SendMailOptions } from "nodemailer/lib/mailer"',
        } })
        try {
            fixture.tester.run("third-party-import-owner", thirdPartyImportOwner, {
                valid: [
                    { filename: fixture.at(MAILER), code: 'import mail from "nodemailer"; export { mail }' },
                    { filename: fixture.at("src/modules/integrations/mailer/mailer.client.spec.ts"), code: 'import type { SendMailOptions } from "nodemailer/lib/mailer"; export type { SendMailOptions }' },
                    { filename: fixture.at("src/modules/integrations/supabase/supabase.client.ts"), code: 'import { createClient } from "@supabase/supabase-js"; import { createRemoteJWKSet } from "jose"; export { createClient, createRemoteJWKSet }' },
                ],
                invalid: [{ filename: fixture.at(OTHER), code: 'import mail from "nodemailer"; export { mail }', errors: [{ messageId: "multiple" }] }],
            })
        } finally { fixture.cleanup() }
    })

    test(`R279 ${edition}: dynamic imports, require, re-exports and npm aliases share one SDK identity`, () => {
        const fixture = fixtureFor({ edition, manifest: { optionalDependencies: { "openai-alias": "npm:openai@1.0.0" } }, files: {
            [MAILER]: 'export const open = () => import(`openai/resources/chat`)',
            "src/modules/integrations/google/google.client.ts": 'const sdk = require("googleapis"); export { sdk }',
            "src/modules/integrations/new/new.client.ts": 'export * from "@new-vendor/io-sdk"',
        } })
        try {
            fixture.tester.run("third-party-import-owner", thirdPartyImportOwner, {
                valid: [{ filename: fixture.at(MAILER), code: 'import sdk from "openai-alias"; export { sdk }' }],
                invalid: [
                    { filename: fixture.at(OTHER), code: 'import sdk from "openai-alias"; export { sdk }', errors: [{ messageId: "multiple" }] },
                    { filename: fixture.at(OTHER), code: 'import sdk from "googleapis"; export { sdk }', errors: [{ messageId: "multiple" }] },
                    { filename: fixture.at(OTHER), code: 'import sdk from "@new-vendor/io-sdk/client"; export { sdk }', errors: [{ messageId: "multiple" }] },
                ],
            })
        } finally { fixture.cleanup() }
    })

    test(`R279 ${edition}: optional, peer and dev SDK dependencies have ownership; local packages are internal`, () => {
        const fixture = fixtureFor({ edition, manifest: {
            optionalDependencies: { "optional-sdk": "1.0.0" }, peerDependencies: { "peer-sdk": "1.0.0" },
            devDependencies: { "dev-sdk": "1.0.0", "@starci/jest-preset": "1.0.0", "@testcontainers/postgresql": "1.0.0" },
            dependencies: { "@fixture/core": "workspace:*", "local-domain": "file:../core" },
        } })
        try {
            fixture.tester.run("third-party-import-owner", thirdPartyImportOwner, {
                valid: [
                    { filename: fixture.at(DOMAIN), code: 'import core from "@fixture/core"; import local from "local-domain"; export { core, local }' },
                    { filename: fixture.at("src/modules/domain/order/order.service.spec.ts"), code: 'import { mock } from "@starci/jest-preset"; export { mock }' },
                    { filename: fixture.at("src/tests/world/use-test-world.ts"), code: 'import { PostgreSqlContainer } from "@testcontainers/postgresql"; export { PostgreSqlContainer }' },
                ],
                invalid: [
                    { filename: fixture.at(DOMAIN), code: 'import sdk from "optional-sdk"; export { sdk }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at(DOMAIN), code: 'import sdk from "peer-sdk"; export { sdk }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at(DOMAIN), code: 'import sdk from "dev-sdk"; export { sdk }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at("src/modules/domain/order/order.service.spec.ts"), code: 'import sdk from "dev-sdk"; export { sdk }', errors: [{ messageId: "foreign" }] },
                    { filename: fixture.at(DOMAIN), code: 'import { PostgreSqlContainer } from "@testcontainers/postgresql"; export { PostgreSqlContainer }', errors: [{ messageId: "foreign" }] },
                ],
            })
        } finally { fixture.cleanup() }
    })

    test(`R279 ${edition}: adding this rule preserves the existing infrastructure table`, () => {
        const fixture = fixtureFor({ edition })
        try {
            const settings = fixture.tester.testerConfig.find((entry) => entry.settings)?.settings
            const linter = new Linter({ cwd: fixture.root })
            const config = [{ files: ["**/*.ts"], languageOptions: { parser: tsParser }, settings, plugins: { be: { rules: { sdk: thirdPartyImportOwner, infra: infraImportOwner } } }, rules: { "be/sdk": "error", "be/infra": "error" } }]
            const verify = (code, filename) => linter.verify(code, config, { filename: fixture.at(filename) })
            assert.deepEqual(verify('import axios from "axios"; export { axios }', "src/modules/platform/http/http.client.ts"), [])
            assert.deepEqual(verify('import sdk from "openai"; export { sdk }', MAILER), [])
            assert.deepEqual(verify('import axios from "axios"; export { axios }', DOMAIN).map((message) => message.ruleId), ["be/infra"])
            assert.deepEqual(verify('import sdk from "openai"; export { sdk }', DOMAIN).map((message) => message.ruleId), ["be/sdk"])
        } finally { fixture.cleanup() }
    })
}
