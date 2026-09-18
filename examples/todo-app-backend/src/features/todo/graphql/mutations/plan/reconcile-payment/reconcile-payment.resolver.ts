import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { ReconcilePaymentCommand, ReconcilePaymentCommandResult } from '@modules/bussiness/plan';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { ReconcilePaymentInput } from './graphql-types/input';
import { ReconcilePaymentResponse } from './graphql-types/response';

/** fr.plan.reconcile's owner-triggered path: "the owner asking the usage screen to check their
 * payment." The scheduled-sweep actor named by the same record has no transport of its own yet - see the
 * final report. */
@Resolver()
export class ReconcilePaymentResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => ReconcilePaymentResponse, { name: 'reconcilePayment', description: "Poll the gateway for a pending payment intent's status (fr.plan.reconcile)." })
  async reconcilePayment(
    @Context('req') req: GraphqlRequestLike,
    @Args('input') input: ReconcilePaymentInput,
  ): Promise<ReconcilePaymentResponse> {
    const actorId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<ReconcilePaymentCommand, ReconcilePaymentCommandResult>(
      new ReconcilePaymentCommand({ actorId, paymentIntentId: input.paymentIntentId }),
    );
    return new ReconcilePaymentResponse(result.gatewayStatus, result.applied, result.subscriptionStatus);
  }
}
