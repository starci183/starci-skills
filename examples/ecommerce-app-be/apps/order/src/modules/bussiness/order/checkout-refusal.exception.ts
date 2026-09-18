import { HttpException, HttpStatus } from '@nestjs/common';
import { CheckoutEvaluationResult } from './checkout.policy';

/**
 * A named checkout refusal (sds.checkout.order-flow t-refuse): the reason, the product it is
 * about and, for stock, how much the catalog actually had. It is an HttpException so the door
 * answers it directly - a refusal never renders as a successful (empty) order.
 */
export class CheckoutRefusalException extends HttpException {
  constructor(refusal: Extract<CheckoutEvaluationResult, { ok: false }>) {
    const status = refusal.reason === 'insufficient-stock' ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
    super(
      { code: 'CHECKOUT_REFUSED', ...refusal },
      status,
    );
  }
}
