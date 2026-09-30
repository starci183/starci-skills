import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { CONTAINERS_KEY } from "./global-setup"

/** Jest global teardown of the test world: stops the containers the setup started. */
export default async function globalTeardown(): Promise<void> {
    const containers: ReadonlyArray<StartedPostgreSqlContainer> | undefined = Reflect.get(globalThis, CONTAINERS_KEY)
    await Promise.all((containers ?? []).map((container) => container.stop()))
}
