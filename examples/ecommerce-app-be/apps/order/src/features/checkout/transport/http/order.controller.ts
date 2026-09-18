import { Controller, HttpException, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ActorParams, SessionGuard } from './session.guard';
import { PlaceOrderResult, OrderService } from '../../../../modules/bussiness/order';

@Controller('orders')
@UseGuards(SessionGuard)
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  /**
   * POST /orders - the confirmation (sds.checkout.order-flow t-confirm): the session was already
   * verified by the guard (order -> identity over HTTP); this door turns the verified person's
   * cart into a confirmed order or a named refusal, and an Idempotency-Key replay returns the
   * first answer rather than a second order.
   */
  @Post()
  async place(@Req() request: Request & { actor?: ActorParams }): Promise<PlaceOrderResult> {
    if (!request.actor) {
      throw new HttpException({ code: 'SESSION_INVALID', message: 'No actor on a guarded request.' }, HttpStatus.UNAUTHORIZED);
    }
    const header = request.headers['idempotency-key'];
    const idempotencyKey = typeof header === 'string' && header.trim() ? header.trim() : undefined;
    return this.orders.place(request.actor.personId, idempotencyKey);
  }
}
