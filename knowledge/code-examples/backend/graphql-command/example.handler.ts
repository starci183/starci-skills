import {
    ICQRSHandler,
} from "@modules/platform/cqrs/icqrs-handler"
import {
    InjectPrimaryPostgreSQLEntityManager,
} from "@modules/databases/postgresql/primary/primary.decorators"
import {
    ExampleItemNotFoundException,
} from "@modules/platform/exceptions/errors/example/example-item-not-found"
import {
    UserNotFoundException,
} from "@modules/platform/exceptions/errors/users/user"
import {
    Injectable,
} from "@nestjs/common"
import {
    CommandHandler,
    ICommandHandler,
} from "@nestjs/cqrs"
import type {
    EntityManager,
} from "typeorm"
import {
    ExampleCreateItemCommand,
} from "./example.command"
import {
    ExampleItemEntity,
} from "./graphql-types/response"

/** Synthetic catalog entity used only for the existence guard. */
class ExampleCatalogEntity {
    id: string
}

@CommandHandler(ExampleCreateItemCommand)
@Injectable()
/**
 * Handler for exampleCreateItem.
 *
 * Idempotently creates a row for `(user, item)`: guards auth, verifies the
 * catalog id exists, returns an existing row when present, otherwise creates one.
 * Synthetic domain — not Academy cart/enrollment policy.
 */
export class ExampleCreateItemHandler
    extends ICQRSHandler<ExampleCreateItemCommand, ExampleItemEntity>
    implements ICommandHandler<ExampleCreateItemCommand, ExampleItemEntity> {
    constructor(
        @InjectPrimaryPostgreSQLEntityManager()
        private readonly entityManager: EntityManager,
    ) {
        super()
    }

    /**
     * Processes the create-item command.
     *
     * @param command - Envelope carrying request + authenticated user.
     * @returns The example item row (created or already present).
     */
    protected override async process(
        command: ExampleCreateItemCommand,
    ): Promise<ExampleItemEntity> {
        const {
            request,
            user,
        } = command.params

        if (!user) {
            throw new UserNotFoundException({
            })
        }

        const {
            itemId,
        } = request

        const itemExists = await this.entityManager.exists(
            ExampleCatalogEntity,
            {
                where: {
                    id: itemId,
                },
            },
        )
        if (!itemExists) {
            throw new ExampleItemNotFoundException({
                id: itemId,
            })
        }

        const existing = await this.entityManager.findOne(
            ExampleItemEntity,
            {
                where: {
                    id: itemId,
                },
            },
        )
        if (existing) {
            return existing
        }

        const item = this.entityManager.create(
            ExampleItemEntity,
            {
                id: itemId,
            },
        )

        return this.entityManager.save(item)
    }
}
