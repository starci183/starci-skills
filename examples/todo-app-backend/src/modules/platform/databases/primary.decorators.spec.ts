import {
    Injectable 
} from "@nestjs/common"
import {
    SELF_DECLARED_DEPS_METADATA 
} from "@nestjs/common/constants"
import {
    Test 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    EntityManager 
} from "typeorm"
import {
    CONNECTION
} from "./persistence/connection"
import {
    InjectPrimaryEntityManager 
} from "./primary.decorators"

@Injectable()
class EntityManagerConsumer {
    constructor(@InjectPrimaryEntityManager() readonly entityManager: EntityManager) {}
}

describe("InjectPrimaryEntityManager",
    () => {
        it("declares the named-connection entity-manager token in the injection metadata",
            () => {
                const deps = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA,
                    EntityManagerConsumer) as Array<{
      index: number;
      param: unknown;
    }>

                expect(deps).toContainEqual({
                    index: 0, param: getEntityManagerToken(CONNECTION) 
                })
                expect(getEntityManagerToken(CONNECTION)).toBe("postgresql-primaryEntityManager")
            })

        it("resolves the primary entity manager from the container at the decorated parameter",
            async () => {
                const fakeManager = {
                    tag: "fake-primary-em" 
                }
                const moduleRef = await Test.createTestingModule({
                    providers: [
                        EntityManagerConsumer,
                        {
                            provide: getEntityManagerToken(CONNECTION), useValue: fakeManager 
                        },
                    ],
                }).compile()
                try {
                    expect(moduleRef.get(EntityManagerConsumer).entityManager).toBe(fakeManager)
                } finally {
                    await moduleRef.close()
                }
            })
    })
