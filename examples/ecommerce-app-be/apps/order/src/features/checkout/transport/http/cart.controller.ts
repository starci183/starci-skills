import { Body, Controller, Delete, Get, HttpException, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ActorParams, SessionGuard } from './session.guard';
import { CartLineResult, CartService } from '../../../../modules/bussiness/cart';
import { ProductResult, CatalogService } from '../../../../modules/bussiness/catalog';

export interface AddCartItemParams {
  productId?: unknown;
  quantity?: unknown;
}

@Controller('cart')
@UseGuards(SessionGuard)
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  async list(@Req() request: Request & { actor?: ActorParams }): Promise<{ items: CartLineResult[]; catalog: ProductResult[] }> {
    const personId = this.person(request);
    return { items: await this.cart.list(personId), catalog: await this.catalog.list() };
  }

  @Post('items')
  async add(
    @Req() request: Request & { actor?: ActorParams },
    @Body() body: AddCartItemParams,
  ): Promise<{ item: CartLineResult }> {
    const personId = this.person(request);
    const productId = typeof body?.productId === 'string' ? body.productId : '';
    const quantity = typeof body?.quantity === 'number' && Number.isInteger(body.quantity) ? body.quantity : 0;
    if (!productId || quantity <= 0) {
      throw new HttpException({ code: 'REQUEST_INVALID', message: 'productId and a positive integer quantity are required.' }, HttpStatus.BAD_REQUEST);
    }
    return { item: await this.cart.add(personId, productId, quantity) };
  }

  @Delete()
  async clear(@Req() request: Request & { actor?: ActorParams }): Promise<{ cleared: true }> {
    await this.cart.clear(this.person(request));
    return { cleared: true };
  }

  private person(request: Request & { actor?: ActorParams }): string {
    if (!request.actor) {
      throw new HttpException({ code: 'SESSION_INVALID', message: 'No actor on a guarded request.' }, HttpStatus.UNAUTHORIZED);
    }
    return request.actor.personId;
  }
}
