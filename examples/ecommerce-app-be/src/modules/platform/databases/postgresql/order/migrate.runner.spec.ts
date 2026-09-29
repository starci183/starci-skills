import {
    DataSource 
} from "typeorm"
import {
    entities, migrations 
} from "./persistence"
import {
    runOrderMigrations 
} from "./migrate.runner"

const URL = "postgres://spec-host:5432/specdb"

describe("runOrderMigrations",
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
                            name: "CreateOrderTables1789800001000", timestamp: 1789800001000 
                        },
                    ] as Awaited<ReturnType<DataSource["runMigrations"]>>)
                const destroy = jest.spyOn(DataSource.prototype,
                    "destroy").mockResolvedValue(undefined)

                const applied = await runOrderMigrations(URL)

                expect(applied).toEqual(["CreateOrderTables1789800001000"])
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

                await expect(runOrderMigrations(URL)).rejects.toThrow("boom")
                expect(destroy).toHaveBeenCalledTimes(1)
            })

        it("lists every entity and every migration explicitly",
            () => {
                expect(entities).toHaveLength(5)
                expect(migrations.map((migration) => migration.name)).toEqual(["CreateOrderTables1789800001000"])
            })
    })
