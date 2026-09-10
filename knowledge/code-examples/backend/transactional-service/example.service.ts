import {
    Injectable,
} from "@nestjs/common"
import {
    InjectPrimaryPostgreSQLEntityManager,
} from "@modules/databases/postgresql/primary/primary.decorators"
import {
    ExampleAlreadyClaimedException,
} from "@modules/platform/exceptions/errors/example/example-already-claimed"
import type {
    EntityManager,
} from "typeorm"
import {
    writeExampleLedger,
} from "./example.ledger.util"

/** Synthetic claim row — teaching stand-in, not an Academy entity. */
export class ExampleClaimEntity {
    userId: string
    periodKey: string
    points: number
}

/** Synthetic user row with a balance field. */
export class ExampleUserEntity {
    id: string
    balance: number
}

/** Result of a successful claim. */
export interface ExampleClaimResult {
    balance: number
    points: number
}

/**
 * Capability service owning cohesive claim behavior.
 * Injects EntityManager via the named primary decorator — never Repository,
 * never a public store.manager facade.
 */
@Injectable()
export class ExampleClaimService {
    constructor(
        @InjectPrimaryPostgreSQLEntityManager()
        private readonly entityManager: EntityManager,
    ) {}

    /**
     * Claims a one-shot reward for the period inside one transaction so a
     * concurrent double-claim cannot double-credit.
     *
     * @param userId - Claiming user id.
     * @param periodKey - Stable period key (for example an ISO week start date).
     * @returns Refreshed balance and granted points.
     */
    async claimReward(
        userId: string,
        periodKey: string,
    ): Promise<ExampleClaimResult> {
        const points = 10

        return this.entityManager.transaction(async (manager) => {
            // ALL reads/writes inside the callback use manager — not this.entityManager
            const existing = await manager.findOne(
                ExampleClaimEntity,
                {
                    where: {
                        userId,
                        periodKey,
                    },
                },
            )
            if (existing) {
                throw new ExampleAlreadyClaimedException({
                    userId,
                    periodKey,
                })
            }

            await writeExampleLedger({
                entityManager: manager,
                userId,
                points,
                refId: `exampleClaim:${userId}:${periodKey}`,
            })

            await manager.save(
                manager.create(
                    ExampleClaimEntity,
                    {
                        userId,
                        periodKey,
                        points,
                    },
                ),
            )

            const user = await manager.findOneOrFail(
                ExampleUserEntity,
                {
                    where: {
                        id: userId,
                    },
                    select: {
                        id: true,
                        balance: true,
                    },
                },
            )

            return {
                balance: user.balance,
                points,
            }
        })
    }
}
