import "reflect-metadata"
import {
    APP_GUARD, APP_INTERCEPTOR 
} from "@nestjs/core"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getDataSourceToken, getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    DataSource 
} from "typeorm"
import {
    AppModule 
} from "./app.module"
import {
    AppConfigService 
} from "@modules/platform/config/order/app-config.service"
import {
    PostgresPrimaryClient 
} from "@modules/platform/databases/postgresql/order/primary.client"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/order/constants/connection"
import {
    CartService 
} from "@modules/bussiness/cart/cart.service"
import {
    CatalogService 
} from "@modules/bussiness/catalog/catalog.service"
import {
    CheckoutPolicy 
} from "@modules/bussiness/order/checkout.policy"
import {
    OrderService 
} from "@modules/bussiness/order/order.service"
import {
    PaymentService 
} from "@modules/bussiness/payment/payment.service"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/identity.client"
import {
    SessionGuard 
} from "@features/checkout/graphql/session.guard"
import {
    BuyerController 
} from "@features/checkout/transport/http/buyer.controller"
import {
    HealthController 
} from "@features/checkout/transport/http/health.controller"
import {
    CartResolver 
} from "@features/checkout/graphql/queries/cart/cart/cart.resolver"
import {
    AddCartItemResolver 
} from "@features/checkout/graphql/mutations/cart/add-cart-item/add-cart-item.resolver"
import {
    ClearCartResolver 
} from "@features/checkout/graphql/mutations/cart/clear-cart/clear-cart.resolver"
import {
    PlaceOrderResolver 
} from "@features/checkout/graphql/mutations/order/place-order/place-order.resolver"

/**
 * The order deployable's DI smoke, sibling of apps/identity's: AppModule must compile with the
 * platform boundary (the named Postgres connection, the metadata/env config) doubled, and every
 * capability service, the identity integration client, the session guard and all transport
 * doors must resolve. This is the test that catches a DI misconfig before behavior specs run.
 */
function postgresBoundary(): { dataSource: DataSource; manager: { findOneBy: jest.Mock; save: jest.Mock } } {
    const manager = {
        findOneBy: jest.fn(), save: jest.fn() 
    }
    const dataSource = {
        isInitialized: false,
        entityMetadatas: [],
        options: {
            type: "postgres" 
        },
        manager,
        getRepository: jest.fn(),
        query: jest.fn(),
        destroy: jest.fn(),
    } as unknown as DataSource
    return {
        dataSource, manager 
    }
}

function configBoundary(): AppConfigService {
    return {
        getProject: () => "ecommerce-app-be",
        getPort: () => 0,
        getDatabaseUrl: () => "postgres://postgres@localhost:0/ecommerce",
        getIdentityApiBaseUrl: () => "http://localhost:0",
    } as unknown as AppConfigService
}

describe("order AppModule - module boot",
    () => {
        let module: TestingModule
        let postgres: ReturnType<typeof postgresBoundary>
        const config = configBoundary()

        beforeAll(async () => {
            postgres = postgresBoundary()
            module = await Test.createTestingModule({
                imports: [AppModule] 
            })
                .overrideProvider(getDataSourceToken(POSTGRESQL_PRIMARY))
                .useValue(postgres.dataSource)
            // forRootAsync's options carry no `name`, so shutdown would look up the default DataSource
            // token and throw; naming the options double keeps module.close() honest.
                .overrideProvider("TypeOrmModuleOptions")
                .useValue({
                    name: POSTGRESQL_PRIMARY, type: "postgres" 
                })
                .overrideProvider(AppConfigService)
                .useValue(config)
                .compile()
        })

        afterAll(async () => {
            await module.close()
        })

        it("compiles the root module with the platform boundary doubled",
            () => {
                expect(module).toBeDefined()
            })

        it("resolves the capability services, the platform client and the identity integration client",
            () => {
                for (const token of [
                    CartService,
                    CatalogService,
                    OrderService,
                    CheckoutPolicy,
                    PaymentService,
                    PostgresPrimaryClient,
                    IdentityApiClient,
                ]) {
                    expect(module.get(token)).toBeDefined()
                }
            })

        it("resolves the session guard, every justified REST controller and every GraphQL resolver",
            () => {
                for (const token of [SessionGuard,
                    BuyerController,
                    HealthController,
                    CartResolver,
                    AddCartItemResolver,
                    ClearCartResolver,
                    PlaceOrderResolver]) {
                    expect(module.get(token)).toBeDefined()
                }
            })

        it("binds the named TypeORM connection and its EntityManager to the doubled DataSource",
            () => {
                expect(module.get(getDataSourceToken(POSTGRESQL_PRIMARY))).toBe(postgres.dataSource)
                expect(module.get(getEntityManagerToken(POSTGRESQL_PRIMARY))).toBe(postgres.manager)
            })

        it("resolves the global config provider as the boundary double",
            () => {
                expect(module.get(AppConfigService)).toBe(config)
            })

        it("registers no global guard or interceptor - session enforcement lives at the resolver doors",
            () => {
                expect(() => module.get(APP_GUARD)).toThrow()
                expect(() => module.get(APP_INTERCEPTOR)).toThrow()
            })
    })
