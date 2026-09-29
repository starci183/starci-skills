import {
    InjectEntityManager 
} from "@nestjs/typeorm"
import {
    CONNECTION 
} from "./persistence"

/**
 * Inject the PRIMARY entity manager - the identity service's one owned database. A named
 * decorator rather than `@InjectEntityManager(CONNECTION)` at every call site, so the
 * connection has one spelling (a typo in a repeated string argument compiles;
 * `InjectPrimryEntityManager` does not) and importing capabilities use
 * `entityManager.findOneBy(Entity, ...)`/`.save(Entity, ...)`/`.delete(Entity, ...)` instead of a
 * per-entity `@InjectRepository` - the house convention: a capability owns behaviour, the
 * databases module owns persistence, and `@InjectRepository` appears nowhere outside it.
 */
export const InjectPrimaryEntityManager = (): ParameterDecorator => InjectEntityManager(CONNECTION)
