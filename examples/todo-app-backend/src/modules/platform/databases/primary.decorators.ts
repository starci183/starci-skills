import {
    InjectEntityManager 
} from "@nestjs/typeorm"
import {
    CONNECTION 
} from "./persistence/connection"

/**
 * Injects the primary entity manager - this example's one owned database. A named decorator rather than
 * `@InjectEntityManager(CONNECTION)` at every call site, so the connection has one spelling; capabilities use
 * `entityManager.findOneBy(Entity, ...)`/`.save(Entity, ...)`/`.delete(Entity, ...)` instead of a per-entity
 * `@InjectRepository`: a capability owns behaviour, the databases module owns persistence.
 */
export const InjectPrimaryEntityManager = (): ParameterDecorator => InjectEntityManager(CONNECTION)
