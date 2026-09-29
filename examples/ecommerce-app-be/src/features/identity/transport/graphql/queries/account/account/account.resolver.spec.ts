import "reflect-metadata"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    AccountService 
} from "@modules/domain/account/index"
import {
    OrderServiceUnavailableException 
} from "@modules/platform/errors/index"
import {
    OrderApiClient 
} from "@modules/integrations/order/index"

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
        let accounts: ReturnType<typeof mock<AccountService>>
        let orderApi: ReturnType<typeof mock<OrderApiClient>>

        beforeEach(async () => {
            accounts = mock<AccountService>()
            orderApi = mock<OrderApiClient>()
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
                await expect(resolver.account({
                    personId: "person-1"
                })).resolves.toEqual({
                    personId: "person-1",
                    email: "demo@ecommerce.dev",
                    hasOrders: true,
                })
                expect(orderApi.getBuyerStatus).toHaveBeenCalledWith("person-1")
            })

        it("answers PERSON_UNKNOWN for an unknown person before asking the order service",
            async () => {
                accounts.getAccount.mockResolvedValue(null)
                await expect(resolver.account({
                    personId: "person-gone"
                })).rejects.toMatchObject({
                    code: "PERSON_UNKNOWN_EXCEPTION", message: "No person answers this id." 
                })
                expect(orderApi.getBuyerStatus).not.toHaveBeenCalled()
            })

        it("propagates the order-service refusal unchanged instead of inventing hasOrders: false",
            async () => {
                accounts.getAccount.mockResolvedValue({
                    personId: "person-1", email: "demo@ecommerce.dev" 
                })
                orderApi.getBuyerStatus.mockRejectedValue(
                    new OrderServiceUnavailableException({
                        message: "The order service could not be reached." 
                    }),
                )
                await expect(resolver.account({
                    personId: "person-1"
                })).rejects.toMatchObject({
                    code: "ORDER_SERVICE_UNAVAILABLE_EXCEPTION",
                    message: "The order service could not be reached.",
                })
            })
    })
