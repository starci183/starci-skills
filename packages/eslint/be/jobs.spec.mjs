/**
 * Twin tests for the fenced-job laws (R137 `BE_JOB_WRITE_OUTSIDE_OWNER`, R138 `BE_JOB_FENCE_REQUIRED`, R139 `BE_JOB_RUN_KEY`,
 * R140 `BE_JOB_SHAPE`).
 *
 *   node --test jobs.spec.mjs
 *
 * The fixture project declares `JobClaims`, `JobStep`, `RunKey`, `FencedProcessor` and the job entity under `platform/jobs`, and a
 * mail gateway under `integrations/mailer`; a case's path decides its slot and tier.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, BE_DECLARATION, typedTester } from "./fixtures/typed/tester.mjs"
import { jobFenceRequired, jobRunKey, jobShape, jobWriteOwner, rules } from "./jobs.mjs"

const tester = typedTester({ declaration: { ...BE_DECLARATION, patterns: ["fenced-job"] } })

const OWNER = at("src/modules/platform/jobs/job-claim.service.ts")
const OWNER_PORT = at("src/modules/platform/jobs/jobs.claims.ts")
const DOMAIN = at("src/modules/domain/order/placing.service.ts")
const HANDLER = at("src/features/checkout/application/place-order.handler.ts")
const STEP = at("src/features/jobs/send/steps/mail.step.ts")
const PROCESSOR = at("src/features/jobs/send/send.processor.ts")
const WORLD = at("src/tests/world/use-test-world.ts")

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

const ENTITY = `import type { EntityManager } from "typeorm"
import { JobEntity } from "@modules/platform/jobs/persistence/entities/job.entity"
`

test("job-write-owner: the job row is written only by platform/jobs", () => {
    tester.run("job-write-owner", jobWriteOwner, {
        valid: [
            { filename: OWNER, code: `${ENTITY}export const claim = (manager: EntityManager) => manager.update(JobEntity, { id: "a" }, { status: "x" })` },
            { filename: OWNER, code: `${ENTITY}export const bump = (manager: EntityManager) => manager.increment(JobEntity, { id: "a" }, "fencingToken", 1)` },
            { filename: DOMAIN, code: `${ENTITY}export const read = (manager: EntityManager) => manager.find(JobEntity, {})` },
            { filename: DOMAIN, code: `import type { EntityManager } from "typeorm"\nimport { OrderEntity } from "./persistence/entities/order.entity"\nexport const w = (manager: EntityManager) => manager.update(OrderEntity, { id: "a" }, { status: "x" })` },
            { filename: DOMAIN, code: `${ENTITY}export const count = (manager: EntityManager) => manager.createQueryBuilder().select().from(JobEntity).where({}).execute()` },
            { filename: WORLD, code: `${ENTITY}export const seed = (manager: EntityManager, job: JobEntity) => manager.save(job)` },
        ],
        invalid: [
            { filename: DOMAIN, code: `${ENTITY}export const w = (manager: EntityManager) => manager.update(JobEntity, { id: "a" }, { status: "done" })`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `${ENTITY}export const w = (manager: EntityManager) => manager.increment(JobEntity, { id: "a" }, "fencingToken", 1)`, errors: [{ messageId: "foreign" }] },
            { filename: HANDLER, code: `${ENTITY}export const w = (manager: EntityManager, job: JobEntity) => manager.save(job)`, errors: [{ messageId: "foreign" }] },
            { filename: STEP, code: `${ENTITY}export const w = (manager: EntityManager) => manager.delete(JobEntity, { id: "a" })`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `${ENTITY}export const w = (manager: EntityManager) => manager.createQueryBuilder().update(JobEntity).set({ status: "x" }).where({}).execute()`, errors: [{ messageId: "foreign" }] },
            { filename: DOMAIN, code: `${ENTITY}export const w = (manager: EntityManager) => manager.createQueryBuilder().delete().from(JobEntity).execute()`, errors: [{ messageId: "foreign" }] },
        ],
    })
})

const CLAIMS = `import type { ClaimedJob, GuardedWrite, JobClaims } from "@modules/platform/jobs"
`

test("job-fence-required: every guarded write requires its token, never casts around it and is never swallowed", () => {
    tester.run("job-fence-required", jobFenceRequired, {
        valid: [
            { filename: OWNER_PORT, code: `import type { EntityManager } from "typeorm"\nimport type { ClaimedJob, GuardedWrite } from "./jobs.contracts"\nexport interface JobClaims {\n advance(write: GuardedWrite & { step: string }): Promise<void>\n complete(write: GuardedWrite): Promise<void>\n claim(params: { kind: string }): Promise<ClaimedJob | null>\n enqueue(tx: EntityManager, params: { kind: string }): Promise<string>\n runKey(job: ClaimedJob, step: string): string\n}` },
            { filename: STEP, code: `${CLAIMS}export const run = (claims: JobClaims, job: ClaimedJob) => claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "a" })` },
            { filename: STEP, code: `${CLAIMS}export const run = async (claims: JobClaims, write: GuardedWrite) => { try { await claims.complete(write) } catch (error) { throw error } }` },
            { filename: STEP, code: `export const run = async (work: () => Promise<void>) => { try { await work() } catch { return } }` },
            { filename: OWNER, code: `${CLAIMS}export const run = async (claims: JobClaims, write: GuardedWrite) => { try { await claims.complete(write) } catch { return } }` },
        ],
        invalid: [
            { filename: OWNER_PORT, code: `import type { LooseWrite } from "./jobs.contracts"\nexport interface JobClaims {\n advance(write: LooseWrite): Promise<void>\n}`, errors: [{ messageId: "optionalToken" }] },
            { filename: STEP, code: `${CLAIMS}export const run = (claims: JobClaims) => claims.complete({ jobId: "a", expectedFencingToken: undefined as unknown as number })`, errors: [{ messageId: "cast" }, { messageId: "cast" }] },
            { filename: STEP, code: `${CLAIMS}export const run = (claims: JobClaims, job: { jobId: string; fencingToken?: number }) => claims.complete({ jobId: job.jobId, expectedFencingToken: job.fencingToken! })`, errors: [{ messageId: "cast" }] },
            { filename: STEP, code: `${CLAIMS}export const run = async (claims: JobClaims, write: GuardedWrite) => { try { await claims.complete(write) } catch (error) { console.log(error) } }`, errors: [{ messageId: "swallowed" }] },
        ],
    })
})

const STEP_HEAD = `import type { ClaimedJob, JobClaims, RunKey } from "@modules/platform/jobs"
import { MailGateway } from "@modules/integrations/mailer/mail.gateway"
`

test("job-run-key: an external call of a step carries the run key made by JobClaims.runKey", () => {
    tester.run("job-run-key", jobRunKey, {
        valid: [
            { filename: STEP, code: `${STEP_HEAD}export class MailStep { constructor(private readonly mail: MailGateway, private readonly claims: JobClaims) {}\n run(job: ClaimedJob): Promise<void> { return this.mail.send("a", this.claims.runKey(job, "send")) } }` },
            { filename: STEP, code: `${STEP_HEAD}export class MailStep { constructor(private readonly mail: MailGateway, private readonly claims: JobClaims) {}\n async run(job: ClaimedJob): Promise<void> { const key = this.claims.runKey(job, "send"); await this.mail.send("a", key) } }` },
            { filename: STEP, code: `${STEP_HEAD}export const local = (claims: JobClaims, job: ClaimedJob): RunKey => claims.runKey(job, "x")` },
            { filename: HANDLER, code: `${STEP_HEAD}export const read = (mail: MailGateway) => mail.status("a")` },
        ],
        invalid: [
            { filename: STEP, code: `${STEP_HEAD}export const run = (mail: MailGateway) => mail.status("a")`, errors: [{ messageId: "missing" }] },
            { filename: STEP, code: `${STEP_HEAD}export const run = (mail: MailGateway) => mail.send("a", "fixed" as RunKey)`, errors: [{ messageId: "forged" }] },
        ],
    })
})

const SHAPE_HEAD = `import type { ClaimedJob, JobStep } from "@modules/platform/jobs"
import { FencedProcessor } from "@modules/platform/jobs"
`

test("job-shape: a processor extends the fenced base in its job folder and a step implements JobStep in steps/", () => {
    tester.run("job-shape", jobShape, {
        valid: [
            { filename: PROCESSOR, code: `${SHAPE_HEAD}export class SendProcessor extends FencedProcessor { async process(job: ClaimedJob): Promise<void> { void job } }` },
            { filename: STEP, code: `${SHAPE_HEAD}export class MailStep implements JobStep { async run(job: ClaimedJob): Promise<void> { void job } }` },
            { filename: at("src/modules/platform/jobs/claim-runner.processor.ts"), code: `export abstract class Base { abstract process(): Promise<void> }` },
            { filename: DOMAIN, code: `export class Plain { run(): number { return 1 } }` },
        ],
        invalid: [
            { filename: PROCESSOR, code: `export class SendProcessor { async process(): Promise<void> {} }`, errors: [{ messageId: "notFenced" }] },
            { filename: at("src/features/jobs/send/other.processor.ts"), code: `${SHAPE_HEAD}export class OtherProcessor extends FencedProcessor { async process(job: ClaimedJob): Promise<void> { void job } }`, errors: [{ messageId: "processorStem" }] },
            { filename: at("src/features/checkout/application/send.processor.ts"), code: `${SHAPE_HEAD}export class SendProcessor extends FencedProcessor { async process(job: ClaimedJob): Promise<void> { void job } }`, errors: [{ messageId: "processorPlacement" }] },
            { filename: STEP, code: `export class MailStep { async run(): Promise<void> {} }`, errors: [{ messageId: "notStep" }] },
            { filename: at("src/features/checkout/application/mail.step.ts"), code: `${SHAPE_HEAD}export class MailStep implements JobStep { async run(job: ClaimedJob): Promise<void> { void job } }`, errors: [{ messageId: "stepPlacement" }] },
            { filename: HANDLER, code: `${SHAPE_HEAD}export class Sneaky implements JobStep { async run(job: ClaimedJob): Promise<void> { void job } }`, errors: [{ messageId: "stepPlacement" }] },
        ],
    })
})
