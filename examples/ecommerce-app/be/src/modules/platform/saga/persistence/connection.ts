import { SagaEventClaimEntity } from "./entities/saga-event-claim.entity"
import { SagaStateEntity } from "./entities/saga-state.entity"
import { CreateSagaStates1789800008000 } from "./migrations/1789800008000-create-saga-states"

/** The entities of the saga capability, for the connection that holds them. */
export const sagaEntities = [SagaStateEntity, SagaEventClaimEntity]

/** The migrations of the saga capability, in the order they run. */
export const sagaMigrations = [CreateSagaStates1789800008000]
