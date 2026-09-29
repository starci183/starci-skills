import {
    DataSource 
} from "typeorm"
import {
    entities, migrations 
} from "./persistence"
import {
    runPrimaryMigrations 
} from "./migrate.runner"

describe("runPrimaryMigrations",
    () => {
        afterEach(() => {
            jest.restoreAllMocks()
        })

        it("initializes a data source over the explicit entities and migrations, runs it and always destroys it",
            async () => {
                const initialize = jest.spyOn(DataSource.prototype,
                    "initialize").mockImplementation(function (this: DataSource) {
                    return Promise.resolve(this)
                })
                const runMigrations = jest.spyOn(DataSource.prototype,
                    "runMigrations").mockResolvedValue([
                        {
                            name: "CreateSessionsTable1758160000000", timestamp: 1758160000000 
                        },
                    ] as Awaited<ReturnType<DataSource["runMigrations"]>>)
                const destroy = jest.spyOn(DataSource.prototype,
                    "destroy").mockResolvedValue(undefined)

                const applied = await runPrimaryMigrations("postgres://spec-host:5432/specdb")

                expect(applied).toEqual(["CreateSessionsTable1758160000000"])
                expect(initialize).toHaveBeenCalledTimes(1)
                expect(runMigrations).toHaveBeenCalledTimes(1)
                expect(destroy).toHaveBeenCalledTimes(1)
            })

        it("destroys the data source and rethrows when a migration fails",
            async () => {
                jest.spyOn(DataSource.prototype,
                    "initialize").mockImplementation(function (this: DataSource) {
                    return Promise.resolve(this)
                })
                jest.spyOn(DataSource.prototype,
                    "runMigrations").mockRejectedValue(new Error("boom"))
                const destroy = jest.spyOn(DataSource.prototype,
                    "destroy").mockResolvedValue(undefined)

                await expect(runPrimaryMigrations("postgres://spec-host:5432/specdb")).rejects.toThrow("boom")
                expect(destroy).toHaveBeenCalledTimes(1)
            })

        it("lists every migration in run order and every entity explicitly",
            () => {
                expect(migrations.map((migration) => migration.name)).toEqual([...migrations.map((migration) => migration.name)].sort((a, b) => a.slice(-13).localeCompare(b.slice(-13))))
                expect(entities).toHaveLength(15)
            })
    })
