/** Edition-specific proofs for the fenced-job and projection rules R157-R162. */
// proves: BE_JOB_WRITE_OUTSIDE_OWNER@lite
// proves: BE_JOB_WRITE_OUTSIDE_OWNER@full
// proves: BE_JOB_FENCE_REQUIRED@lite
// proves: BE_JOB_FENCE_REQUIRED@full
// proves: BE_JOB_RUN_KEY@lite
// proves: BE_JOB_RUN_KEY@full
// proves: BE_JOB_SHAPE@lite
// proves: BE_JOB_SHAPE@full
// proves: BE_PROJECTION_WRITE_OWNER@lite
// proves: BE_PROJECTION_WRITE_OWNER@full
// proves: BE_PROJECTION_SHAPE@lite
// proves: BE_PROJECTION_SHAPE@full
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { at, BE_DECLARATION, ruleTester, TYPED_ROOT } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { jobFenceRequired, jobRunKey, jobShape, jobWriteOwner } from "./jobs.mjs"
import { projectionShape, projectionWriteOwner } from "./projections.mjs"

const OWNER = at("src/modules/platform/jobs/job-claim.service.ts")
const OWNER_PORT = at("src/modules/platform/jobs/jobs.claims.ts")
const DOMAIN = at("src/modules/domain/order/placing.service.ts")
const STEP = at("src/features/jobs/send/steps/mail.step.ts")
const PROCESSOR = at("src/features/jobs/send/transport/queue/send.processor.ts")
const PROJECTION = at("src/modules/projections/userxp/scratch.projection.ts")
const PROJECTION_INDEX = at("src/modules/projections/scratch/index.ts")
const API_HANDLER = at("src/features/api/checkout/application/show-xp.handler.ts")
const REACTOR = at("src/features/reactors/stock/stock.consumer.ts")

const JOB_ENTITY = `import type { EntityManager } from "typeorm"
import { JobEntity } from "@modules/platform/jobs/persistence/entities/job.entity"
`
const CLAIMS = `import type { ClaimedJob, GuardedWrite, JobClaims } from "@modules/platform/jobs"
`
const EFFECT = `import type { ClaimedJob, JobClaims, RunKey } from "@modules/platform/jobs"
import { MailGateway } from "@modules/integrations/mailer/mail.gateway"
`
const JOB_SHAPE = `import type { ClaimedJob, JobStep } from "@modules/platform/jobs"
import { FencedProcessor } from "@modules/platform/jobs"
`
const PROJECTION_ENTITY = `import type { EntityManager } from "typeorm"
import { UserXpProjectionEntity } from "@modules/projections/userxp/user-xp.projection-entity"
`
const PROJECTION_PORT = `import type { UserXpProjection } from "@modules/projections/userxp"
`

for (const edition of ["lite", "full"]) {
    test(`job and projection rules accept valid cases and reject invalid cases in ${edition}`, () => {
        const declaration = appDeclaration("be", { ...BE_DECLARATION, patterns: ["fenced-job", "projection", "event-bus"] })
        const hfs = hfsFromDeclaration({ ...declaration, edition }, TYPED_ROOT)
        assert.equal(hfs.edition, edition)
        const tester = ruleTester({ root: TYPED_ROOT, hfs })

        tester.run("job-write-owner", jobWriteOwner, {
            valid: [
                { filename: OWNER, code: `${JOB_ENTITY}export const claim = (manager: EntityManager) => manager.update(JobEntity, { id: "a" }, { status: "claimed" })` },
                { filename: DOMAIN, code: `${JOB_ENTITY}export const read = (manager: EntityManager) => manager.find(JobEntity, {})` },
            ],
            invalid: [
                { filename: DOMAIN, code: `${JOB_ENTITY}export const overwrite = (manager: EntityManager) => manager.update(JobEntity, { id: "a" }, { status: "done" })`, errors: [{ messageId: "foreign" }] },
                { filename: STEP, code: `${JOB_ENTITY}export const erase = (manager: EntityManager) => manager.createQueryBuilder().delete().from(JobEntity).execute()`, errors: [{ messageId: "foreign" }] },
            ],
        })

        tester.run("job-fence-required", jobFenceRequired, {
            valid: [
                { filename: OWNER_PORT, code: `import type { GuardedWrite } from "./jobs.contracts"
export interface JobClaims { complete(write: GuardedWrite): Promise<void> }` },
                { filename: STEP, code: `${CLAIMS}export const complete = (claims: JobClaims, job: ClaimedJob) => claims.complete({ jobId: job.jobId, expectedFencingToken: job.fencingToken })` },
                { filename: STEP, code: `${CLAIMS}export const complete = async (claims: JobClaims, write: GuardedWrite) => { try { await claims.complete(write) } catch (error) { throw error } }` },
            ],
            invalid: [
                { filename: OWNER_PORT, code: `import type { LooseWrite } from "./jobs.contracts"
export interface JobClaims { complete(write: LooseWrite): Promise<void> }`, errors: [{ messageId: "optionalToken" }] },
                { filename: STEP, code: `${CLAIMS}export const complete = (claims: JobClaims, job: { jobId: string; fencingToken?: number }) => claims.complete({ jobId: job.jobId, expectedFencingToken: job.fencingToken! })`, errors: [{ messageId: "cast" }] },
                { filename: STEP, code: `${CLAIMS}export const complete = async (claims: JobClaims, write: GuardedWrite) => { try { await claims.complete(write) } catch (error) { console.log(error) } }`, errors: [{ messageId: "swallowed" }] },
            ],
        })

        tester.run("job-run-key", jobRunKey, {
            valid: [
                { filename: STEP, code: `${EFFECT}export const send = (mail: MailGateway, claims: JobClaims, job: ClaimedJob) => mail.send("a", claims.runKey(job, "send"))` },
            ],
            invalid: [
                { filename: STEP, code: `${EFFECT}export const send = (mail: MailGateway) => mail.status("a")`, errors: [{ messageId: "missing" }] },
                { filename: STEP, code: `${EFFECT}export const send = (mail: MailGateway) => mail.send("a", "fixed" as RunKey)`, errors: [{ messageId: "forged" }] },
            ],
        })

        tester.run("job-shape", jobShape, {
            valid: [
                { filename: PROCESSOR, code: `${JOB_SHAPE}export class SendProcessor extends FencedProcessor { async process(job: ClaimedJob): Promise<void> { void job } }` },
                { filename: STEP, code: `${JOB_SHAPE}export class MailStep implements JobStep { async run(job: ClaimedJob): Promise<void> { void job } }` },
            ],
            invalid: [
                { filename: PROCESSOR, code: "export class SendProcessor { async process(): Promise<void> {} }", errors: [{ messageId: "notFenced" }] },
                { filename: at("src/features/jobs/send/transport/queue/other.processor.ts"), code: `${JOB_SHAPE}export class OtherProcessor extends FencedProcessor { async process(job: ClaimedJob): Promise<void> { void job } }`, errors: [{ messageId: "processorStem" }] },
                { filename: at("src/features/checkout/application/send.processor.ts"), code: `${JOB_SHAPE}export class SendProcessor extends FencedProcessor { async process(job: ClaimedJob): Promise<void> { void job } }`, errors: [{ messageId: "processorPlacement" }] },
                { filename: STEP, code: "export class MailStep { async run(): Promise<void> {} }", errors: [{ messageId: "notStep" }] },
                { filename: at("src/features/checkout/application/mail.step.ts"), code: `${JOB_SHAPE}export class MailStep implements JobStep { async run(job: ClaimedJob): Promise<void> { void job } }`, errors: [{ messageId: "stepPlacement" }] },
            ],
        })

        tester.run("projection-write-owner", projectionWriteOwner, {
            valid: [
                { filename: PROJECTION, code: `${PROJECTION_ENTITY}export const recompute = (manager: EntityManager) => manager.update(UserXpProjectionEntity, { userId: "a" }, { total: 1 })` },
                { filename: DOMAIN, code: `${PROJECTION_ENTITY}export const read = (manager: EntityManager) => manager.find(UserXpProjectionEntity, {})` },
            ],
            invalid: [
                { filename: DOMAIN, code: `${PROJECTION_ENTITY}export const overwrite = (manager: EntityManager) => manager.update(UserXpProjectionEntity, { userId: "a" }, { total: 9 })`, errors: [{ messageId: "foreign" }] },
                { filename: at("src/modules/projections/other/other.projection.ts"), code: `${PROJECTION_ENTITY}export const erase = (manager: EntityManager) => manager.delete(UserXpProjectionEntity, {})`, errors: [{ messageId: "foreign" }] },
            ],
        })

        tester.run("projection-shape", projectionShape, {
            valid: [
                { filename: PROJECTION, code: "export class UserXpProjection { async recompute(): Promise<void> {} async get(): Promise<number> { return 0 } }" },
                { filename: PROJECTION_INDEX, code: 'export { UserXpProjection } from "./user-xp.projection"' },
                { filename: API_HANDLER, code: `${PROJECTION_PORT}export const show = (projection: UserXpProjection) => projection.getUserXp("a")` },
                { filename: REACTOR, code: `${PROJECTION_PORT}export const react = (projection: UserXpProjection) => projection.recomputeUserXp("a", 1)` },
            ],
            invalid: [
                { filename: PROJECTION, code: "export class UserXpProjection { async rebuildEverything(): Promise<void> {} }", errors: [{ messageId: "vocabulary" }] },
                { filename: PROJECTION_INDEX, code: 'export { UserXpProjectionEntity } from "./user-xp.projection-entity"', errors: [{ messageId: "entityExported" }] },
                { filename: API_HANDLER, code: `${PROJECTION_PORT}export const show = (projection: UserXpProjection) => projection.recomputeUserXp("a", 1)`, errors: [{ messageId: "apiRecompute" }] },
            ],
        })
    })
}
