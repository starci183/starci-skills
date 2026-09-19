import "reflect-metadata"
import {
    HttpException, HttpStatus 
} from "@nestjs/common"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AccountService 
} from "@modules/bussiness/account/account.service"
import {
    OrderApiClient 
} from "@modules/integrations/order/order.client"

import {
    AccountResolver 
} from "./account.resolver"

/**
 * The account query in unit form, after the GraphQL migration: the account view joins the local
 * person row with buyer status read live through contract.checkout.order-for-identity. An
 * order-service outage must surface as its typed refusal, never degrade into `hasOrders: false`
 * - an absent answer is not a no.
 */
describe("AccountResolver - contract.checkout.order-for-identity account view",
    () => {
        let resolver: AccountResolver
        let accounts: { getAccount: jest.Mock }
        let orderApi: { getBuyerStatus: jest.Mock }

        beforeEach(async () => {
            accounts = {
                getAccount: jest.fn() 
            }
            orderApi = {
                getBuyerStatus: jest.fn() 
            }
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    AccountResolver,
                    {
                        provide: AccountService, useValue: accounts 
                    },
                    {
                        provide: OrderApiClient, useValue: orderApi 
                    },
                ],
            }).compile()
            resolver = module.get(AccountResolver)
        })

        it("joins the person row with the live buyer status",
            async () => {
                accounts.getAccount.mockResolvedValue({
                    personId: "person-1", email: "demo@ecommerce.dev" 
                })
                orderApi.getBuyerStatus.mockResolvedValue({
                    personId: "person-1", hasOrders: true 
                })
                await expect(resolver.account("person-1")).resolves.toEqual({
                    personId: "person-1",
                    email: "demo@ecommerce.dev",
                    hasOrders: true,
                })
                expect(orderApi.getBuyerStatus).toHaveBeenCalledWith("person-1")
            })

        it("answers PERSON_UNKNOWN for an unknown person before asking the order service",
            async () => {
                accounts.getAccount.mockResolvedValue(null)
                try {
                    await resolver.account("person-gone")
                    throw new Error("the request should have been refused")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(404)
                    expect((error as HttpException).getResponse()).toEqual({
                        code: "PERSON_UNKNOWN_EXCEPTION", message: "No person answers this id." 
                    })
                }
                expect(orderApi.getBuyerStatus).not.toHaveBeenCalled()
            })

        it("propagates the order-service refusal unchanged instead of inventing hasOrders: false",
            async () => {
                accounts.getAccount.mockResolvedValue({
                    personId: "person-1", email: "demo@ecommerce.dev" 
                })
                orderApi.getBuyerStatus.mockRejectedValue(
                    new HttpException({
                        code: "ORDER_SERVICE_UNAVAILABLE_EXCEPTION", message: "The order service could not be reached." 
                    },
                    HttpStatus.SERVICE_UNAVAILABLE),
                )
                try {
                    await resolver.account("person-1")
                    throw new Error("the request should have been refused")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(503)
                    expect((error as HttpException).getResponse()).toEqual({
                        code: "ORDER_SERVICE_UNAVAILABLE_EXCEPTION",
                        message: "The order service could not be reached.",
                    })
                }
            })
    })
