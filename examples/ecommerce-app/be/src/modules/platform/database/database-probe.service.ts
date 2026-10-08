import { Injectable } from "@nestjs/common"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"
import { eachInOrder } from "@modules/platform/primitives"
import type { Probe } from "@modules/platform/probes"
import { PING } from "./database.sql"

/** Token of the managers of every connection the app opened. */
export const DATABASE_MANAGERS: unique symbol = Symbol("platform.database.managers")

/** Injects the managers of every connection the app opened. Parameter type: ReadonlyArray of EntityManager. */
export const InjectDatabaseManagers = (): TypedParameterDecorator<ReadonlyArray<EntityManager>> =>
    injector<ReadonlyArray<EntityManager>>(DATABASE_MANAGERS)

@Injectable()
/** The health probe of the database capability: every connection the app opened must answer a ping. */
export class DatabaseProbe implements Probe {
    /** The name the health report lists this probe under. */
    readonly name = "database"

    constructor(@InjectDatabaseManagers() private readonly managers: ReadonlyArray<EntityManager>) {}

    /** Resolves when every connection answers, rejects with the driver failure when one does not. */
    check(): Promise<void> {
        return eachInOrder(this.managers, (manager) => manager.query(PING, []))
    }
}
