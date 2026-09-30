/**
 * Teardown contract verification. Boots the run-scoped stack, records the exact containers and volumes this run created,
 * closes the world (the same path every spec afterAll takes), then proves by direct docker observation that none of them
 * remain: the contract E2EStack implements in close (`down -v` plus cleanup verification). Skips with a reason when no docker
 * daemon answers.
 */
import { dockerProbe, projectContainerNames, projectVolumeNames } from "../setup/docker.client"
import { bootE2eWorld } from "../setup/e2e-world"

const describeE2E = dockerProbe().available ? describe : describe.skip

describeE2E("resilience: teardown verification", () => {
    jest.setTimeout(900_000) // first-boot images (postgres, keycloak realm import) and two app processes can take minutes

    it("closing the world removes every container and volume the run created", async () => {
        const world = await bootE2eWorld("resilience/teardown-verification")
        const { project } = world.stack

        // The persisted world is real before teardown, and the run owns the containers and volumes proven gone below.
        expect(await world.database.ping()).toBe(true)
        expect(projectContainerNames(project).length).toBeGreaterThan(0)
        expect(projectVolumeNames(project).length).toBeGreaterThan(0)

        await world.close()

        // The contract: after close, nothing of this run project survives on the daemon.
        expect(projectContainerNames(project)).toEqual([])
        expect(projectVolumeNames(project)).toEqual([])

        // The stack own teardown self-report agrees with the docker observation.
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })
})
