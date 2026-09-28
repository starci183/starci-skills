import {
    Test 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    In 
} from "typeorm"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/order/constants/connection"
import {
    ProductEntity 
} from "@modules/platform/databases/postgresql/order/entities/product.entity"
import {
    CatalogService 
} from "./catalog.service"

describe("CatalogService - the read side of the catalog",
    () => {
        const entityManager = {
            find: jest.fn(),
            findBy: jest.fn(),
        }
        let service: CatalogService

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [
                    CatalogService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: entityManager 
                    },
                ],
            }).compile()
            service = moduleRef.get(CatalogService)
        })

        it("list answers every product in id order, mapped to the public shape",
            async () => {
                entityManager.find.mockResolvedValue([
                    {
                        id: "sku-mug", name: "Mug", priceMinorUnits: 1299, stock: 40 
                    },
                    {
                        id: "sku-thermos", name: "Thermos", priceMinorUnits: 2499, stock: 2 
                    },
                ])
                const products = await service.list()
                expect(entityManager.find).toHaveBeenCalledWith(ProductEntity,
                    {
                        order: {
                            id: "ASC" 
                        } 
                    })
                expect(products).toEqual([
                    {
                        id: "sku-mug", name: "Mug", priceMinorUnits: 1299, stock: 40 
                    },
                    {
                        id: "sku-thermos", name: "Thermos", priceMinorUnits: 2499, stock: 2 
                    },
                ])
            })

        it("byIds answers a lookup keyed by id; ids with no row stay absent",
            async () => {
                entityManager.findBy.mockResolvedValue([
                    {
                        id: "sku-mug", name: "Mug", priceMinorUnits: 1299, stock: 40 
                    },
                ])
                const found = await service.byIds(["sku-mug",
                    "sku-ghost"])
                expect(entityManager.findBy).toHaveBeenCalledWith(ProductEntity,
                    {
                        id: In(["sku-mug",
                            "sku-ghost"]) 
                    })
                expect(found).toEqual({
                    "sku-mug": {
                        id: "sku-mug", name: "Mug", priceMinorUnits: 1299, stock: 40 
                    } 
                })
                expect(found["sku-ghost"]).toBeUndefined()
            })

        it("byIds on an empty id list never touches the repository",
            async () => {
                expect(await service.byIds([])).toEqual({
                })
                expect(entityManager.findBy).not.toHaveBeenCalled()
            })

        it("byIds with a repeated id asks the repository once and answers one entry",
            async () => {
                entityManager.findBy.mockResolvedValue([
                    {
                        id: "sku-mug", name: "Mug", priceMinorUnits: 1299, stock: 40 
                    },
                ])
                const found = await service.byIds(["sku-mug",
                    "sku-mug"])
                expect(entityManager.findBy).toHaveBeenCalledTimes(1)
                expect(found).toEqual({
                    "sku-mug": {
                        id: "sku-mug", name: "Mug", priceMinorUnits: 1299, stock: 40 
                    } 
                })
            })

        it("a product listing carries zero stock through - visibility is the catalog's job, refusal is the policy's",
            async () => {
                entityManager.find.mockResolvedValue([
                    {
                        id: "sku-mug", name: "Mug", priceMinorUnits: 1299, stock: 0 
                    },
                ])
                const products = await service.list()
                expect(products).toEqual([{
                    id: "sku-mug", name: "Mug", priceMinorUnits: 1299, stock: 0 
                }])
            })
    })
