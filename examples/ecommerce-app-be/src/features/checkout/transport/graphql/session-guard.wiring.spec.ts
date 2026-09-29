import "reflect-metadata"
import {
    ExecutionContext 
} from "@nestjs/common"
import {
    GUARDS_METADATA, ROUTE_ARGS_METADATA 
} from "@nestjs/common/constants"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getDataSourceToken 
} from "@nestjs/typeorm"
import {
    Request 
} from "express"
import {
    DataSource, EntityManager, Repository 
} from "typeorm"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    SessionInvalidException 
} from "@modules/platform/errors/index"
import {
    CheckoutGraphqlModule 
} from "./checkout-graphql.module"
import {
    OrderConfigModule, OrderConfigService 
} from "@modules/platform/config/index"
import {
    OrderPostgresqlPrimaryModule, ORDER_POSTGRESQL 
} from "@modules/platform/databases/index"
import {
    CatalogModule 
} from "@modules/domain/catalog/index"
import {
    CartModule 
} from "@modules/domain/cart/index"
import {
    PaymentModule 
} from "@modules/domain/payment/index"
import {
    OrderModule 
} from "@modules/domain/order/index"
import {
    IdentityModule, IdentityApiClient 
} from "@modules/integrations/identity/index"
import {
    ActorParams, SessionGuard 
} from "./session.guard"
import {
    SessionActor 
} from "./session-actor.decorator"
import {
    CartResolver 
} from "./queries/cart/cart/cart.resolver"
import {
    AddCartItemResolver 
} from "./mutations/cart/add-cart-item/add-cart-item.resolver"
import {
    ClearCartResolver 
} from "./mutations/cart/clear-cart/clear-cart.resolver"
import {
    PlaceOrderResolver 
} from "./mutations/order/place-order/place-order.resolver"

/**
 * The checkout session door in wiring form, after the GraphQL migration: SessionGuard must
 * resolve through the GraphQL composition with the identity integration client injected, must
 * sit as the one class-level guard on every person-scoped resolver, and the SessionActor
 * decorator must hand the resolver exactly the person the guard verified - or refuse a
 * guarded request that somehow carries none. The canActivate assertions prove the guard's
 * refusal shape - the consumer-obligation doctrine that an unverifiable or missing token is
 * this service's own refusal, never an invented actor - now through a GraphQL execution
 * context instead of an HTTP one.
 *
 * The import list mirrors the apps/order composition root: the capability and platform modules
 * the GraphQL transport relies on are registered app-wide, exactly as the deployable declares
 * them.
 */
/** A GraphQL ExecutionContext the way Apollo hands it to a guard: `getType()` answers
 * "graphql", and the context object - with the HTTP request the driver exposed - sits at
 * argument index 2, which is where GqlExecutionContext.getContext() reads it. */
function graphqlContext(request: Partial<Request & { actor?: ActorParams }>): ExecutionContext {
    class ProbeClass {}
    const handler = (): void => undefined
    const args: Array<unknown> = [{
    },
    {
    },
    {
        req: request 
    },
    {
    }]
    return mock<ExecutionContext>({
        getType: jest.fn().mockReturnValue("graphql"),
        getArgs: jest.fn().mockReturnValue(args),
        getArgByIndex: jest.fn().mockImplementation((index: number) => args[index]),
        getClass: jest.fn().mockReturnValue(ProbeClass),
        getHandler: jest.fn().mockReturnValue(handler),
    })
}

/** The factory a param decorator registered - read back off a probe class's ROUTE_ARGS
 * metadata, the same way Nest's param pipeline finds it at runtime. */
function sessionActorFactory(): (data: unknown, context: ExecutionContext) => ActorParams {
    class Probe {
        probe(@SessionActor() actor?: ActorParams): ActorParams | undefined {
            return actor
        }
    }
    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA,
        Probe,
        "probe") as Record<string, { factory: (data: unknown, context: ExecutionContext) => ActorParams }>
    return Object.values(metadata)[0].factory
}

async function expectSessionRefusal(guard: SessionGuard, context: ExecutionContext): Promise<void> {
    await expect(guard.canActivate(context)).rejects.toMatchObject({
        name: "SessionInvalidException", code: "SESSION_INVALID_EXCEPTION" 
    })
}

describe("checkout SessionGuard - GraphQL wiring",
    () => {
        let module: TestingModule
        let guard: SessionGuard
        const identity = mock<IdentityApiClient>()

        beforeAll(async () => {
            const dataSource = mock<DataSource>({
                isInitialized: false,
                entityMetadatas: [],
                options: {
                    type: "postgres" 
                },
                manager: mock<EntityManager>(),
                getRepository: jest.fn().mockReturnValue(mock<Repository<object>>()),
                query: jest.fn(),
                destroy: jest.fn(),
            })
            const config = mock<OrderConfigService>({
                getProject: () => "ecommerce-app-be",
                getPort: () => 0,
                getDatabaseUrl: () => "postgres://postgres@localhost:0/ecommerce",
                getIdentityApiBaseUrl: () => "http://localhost:0",
            })
            module = await Test.createTestingModule({
                imports: [
                    OrderConfigModule.register({
                        isGlobal: true 
                    }),
                    OrderPostgresqlPrimaryModule.register({
                        isGlobal: true 
                    }),
                    CatalogModule.register({
                        isGlobal: true 
                    }),
                    CartModule.register({
                        isGlobal: true 
                    }),
                    IdentityModule.register({
                        isGlobal: true 
                    }),
                    PaymentModule.register({
                        isGlobal: true 
                    }),
                    OrderModule.register({
                        isGlobal: true 
                    }),
                    CheckoutGraphqlModule,
                ] 
            })
                .overrideProvider(getDataSourceToken(ORDER_POSTGRESQL))
                .useValue(dataSource)
            // forRootAsync's options carry no `name`, so shutdown would look up the default DataSource
            // token and throw; naming the options double keeps module.close() honest.
                .overrideProvider("TypeOrmModuleOptions")
                .useValue({
                    name: ORDER_POSTGRESQL, type: "postgres" 
                })
                .overrideProvider(OrderConfigService)
                .useValue(config)
                .overrideProvider(IdentityApiClient)
                .useValue(identity)
                .compile()
            guard = module.get(SessionGuard)
        })

        afterAll(async () => {
            await module.close()
        })

        beforeEach(() => {
            jest.clearAllMocks()
        })

        it("resolves SessionGuard through the GraphQL composition",
            () => {
                expect(guard).toBeInstanceOf(SessionGuard)
            })

        it("places exactly SessionGuard, in class position, on every person-scoped resolver",
            () => {
                for (const resolver of [CartResolver,
                    AddCartItemResolver,
                    ClearCartResolver,
                    PlaceOrderResolver]) {
                    const guards = Reflect.getMetadata(GUARDS_METADATA,
                        resolver) as Array<unknown> | undefined
                    expect(guards).toEqual([SessionGuard])
                }
            })

        it.each([{
            headers: {
            } 
        },
        {
            headers: {
                authorization: "Basic abc" 
            } 
        },
        {
            headers: {
                authorization: "Bearer " 
            } 
        }])(
            "refuses a request carrying no Bearer token %j before identity is called",
            async (request) => {
                await expectSessionRefusal(guard,
                    graphqlContext(request as Partial<Request & { actor?: ActorParams }>))
                expect(identity.verifySession).not.toHaveBeenCalled()
            },
        )

        it("admits a verified Bearer token and stamps the verified person on the request",
            async () => {
                identity.verifySession.mockResolvedValue({
                    personId: "person-9" 
                })
                const request = {
                    headers: {
                        authorization: "Bearer token-abc" 
                    } 
                } as Request & { actor?: ActorParams }
                await expect(guard.canActivate(graphqlContext(request))).resolves.toBe(true)
                expect(identity.verifySession).toHaveBeenCalledWith("token-abc")
                expect(request.actor).toEqual({
                    personId: "person-9" 
                })
            })

        it("refuses when identity answers that no live session owns the token",
            async () => {
                identity.verifySession.mockResolvedValue(null)
                const request = {
                    headers: {
                        authorization: "Bearer token-gone" 
                    } 
                } as Request & { actor?: ActorParams }
                await expectSessionRefusal(guard,
                    graphqlContext(request))
                expect(identity.verifySession).toHaveBeenCalledWith("token-gone")
                expect(request.actor).toBeUndefined()
            })

        it("hands the resolver the actor the guard stamped, and refuses a guarded request carrying none",
            () => {
                const actorOf = sessionActorFactory()
                const request = {
                    actor: {
                        personId: "person-9" 
                    } 
                } as Request & { actor?: ActorParams }
                expect(actorOf(undefined,
                    graphqlContext(request))).toEqual({
                    personId: "person-9" 
                })
                expect(() => actorOf(undefined,
                    graphqlContext({
                        headers: {
                        } 
                    }))).toThrow(SessionInvalidException)
            })
    })
