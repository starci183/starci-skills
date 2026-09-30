/**
 * Infra-down recovery. Boots the run-scoped stack, kills the postgres container mid-run (the one dependency the api /health
 * probe checks; the worker polls the same database), asserts the api stays alive and answers /health with a clean 503 instead
 * of hanging or crashing, starts the same container back (identical ports and volume), and asserts the api recovers to 200,
 * the persisted world is intact, and the worker recovered too: a sign-in made after the outage gets its audit line appended
 * through the outbox and the worker consumer. Skips with a reason when no docker daemon answers.
 */
import { pollUntil } from "@e2e-kit/platform/poll"
import { retryUntil } from "@e2e-kit/platform/readiness"
import { dockerProbe, killService, startContainer } from "../setup/docker.client"
import { bootE2eWorld } from "../setup/e2e-world"
import type { ExportMyDataData } from "../setup/e2e-views.contracts"

const describeE2E = dockerProbe().available ? describe : describe.skip

describeE2E("resilience: infra recovery", () => {
    jest.setTimeout(900_000)

    it("a postgres outage yields a clean api error and the api and the worker recover when postgres returns", async () => {
        const world = await bootE2eWorld("resilience/infra-recovery")
        try {
            const { database, graphql, auth } = world

            // Baseline: the out-of-band data channel answers and the persisted world holds its migrated tables.
            expect(await database.ping()).toBe(true)
            expect(await database.tables()).toEqual(expect.arrayContaining(["sessions", "tasks", "outbox_messages", "inbox_claims"]))

            const killed = killService(world.stack.project, "postgres")

            // The api tolerates the outage: still answering HTTP, with a declared dependency error.
            await retryUntil("api /health answers 503", 90_000, async () => (await world.http().get("/health")).status === 503)

            startContainer(killed)

            await retryUntil("api /health recovers to 200", 180_000, async () => (await world.http().get("/health")).status === 200)

            // Persisted-state evidence: postgres itself answers real queries again, and its data survived the outage.
            expect(await database.ping()).toBe(true)
            expect(await database.tables()).toEqual(expect.arrayContaining(["sessions", "tasks"]))

            // The worker recovered with the database: a sign-in made now writes its audit message in the transaction of the
            // session; the line only becomes readable once the worker consumer appended it.
            const session = await auth.signInAs("owner")
            await pollUntil(
                "the audit line of the post-outage sign-in appended by the worker",
                async () => {
                    const observed = await graphql.client(session.sessionToken).read<ExportMyDataData>("exportMyData")
                    const lines = observed.data?.exportMyData ?? []
                    return lines.some((line) => line.action === "login.signed-in") ? lines : null
                },
                120_000,
                1_000,
            )
        } finally {
            await world.close()
        }
    })
})
