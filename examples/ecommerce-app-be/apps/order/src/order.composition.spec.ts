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
    DataSource, EntityManager 
} from "typeorm"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    AppModule 
} from "./app.module"
import {
    Logger 
} from "@modules/platform/logging"
import {
    Clock, SystemClock 
} from "@modules/platform/clock/index"
import {
    OrderConfigService 
} from "@modules/platform/config/index"
import {
    OrderPostgresPrimaryClient, ORDER_POSTGRESQL 
} from "@modules/platform/databases/index"
import {
    CartService 
} from "@modules/domain/cart/index"
import {
    CatalogService 
} from "@modules/domain/catalog/index"
import {
    CheckoutPolicy, OrderService 
} from "@modules/domain/order/index"
import {
    PaymentService 
} from "@modules/domain/payment/index"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/index"
import {
    SessionGuard, BuyerController, HealthController, CartResolver, AddCartItemResolver, ClearCartResolver, PlaceOrderResolver 
} from "@features/checkout/index"

/**
 * The order deployable's DI smoke, sibling of apps/identity's: AppModule must compile with the
 * platform boundary (the named Postgres connection, the metadata/env config) doubled, and every
 * capability service, the identity integration client, the session guard and all transport
 * doors must resolve. This is the test that catches a DI misconfig before behavior specs run.
 */
function postgresBoundary(): { dataSource: DataSource; manager: EntityManager } {
    const manager = mock<EntityManager>({
        findOneBy: jest.fn(), save: jest.fn() 
    })
    const dataSource = mock<DataSource>({
        isInitialized: false,
        entityMetadatas: [],
        options: {
            type: "postgres" 
        },
        manager,
        getRepository: jest.fn(),
        query: jest.fn(),
        destroy: jest.fn(),
    })
    return {
        dataSource, manager 
    }
}

function configBoundary(): OrderConfigService {
    return mock<OrderConfigService>({
        getProject: () => "ecommerce-app-be",
        getPort: () => 0,
        getDatabaseUrl: () => "postgres://postgres@localhost:0/ecommerce",
        getIdentityApiBaseUrl: () => "http://localhost:0",
    })
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
                .overrideProvider(getDataSourceToken(ORDER_POSTGRESQL))
                .useValue(postgres.dataSource)
            // forRootAsync's options carry no `name`, so shutdown would look up the default DataSource
            // token and throw; naming the options double keeps module.close() honest.
                .overrideProvider("TypeOrmModuleOptions")
                .useValue({
                    name: ORDER_POSTGRESQL, type: "postgres" 
                })
                .overrideProvider(OrderConfigService)
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
                    OrderPostgresPrimaryClient,
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
                expect(module.get(getDataSourceToken(ORDER_POSTGRESQL))).toBe(postgres.dataSource)
                expect(module.get(getEntityManagerToken(ORDER_POSTGRESQL))).toBe(postgres.manager)
            })

        it("resolves the global config provider as the boundary double",
            () => {
                expect(module.get(OrderConfigService)).toBe(config)
                expect(module.get(Logger)).toBeInstanceOf(Logger)
                expect(module.get(Clock)).toBeInstanceOf(SystemClock)
            })

        it("registers no global guard or interceptor - session enforcement lives at the resolver doors",
            () => {
                expect(() => module.get(APP_GUARD)).toThrow()
                expect(() => module.get(APP_INTERCEPTOR)).toThrow()
            })
    })
