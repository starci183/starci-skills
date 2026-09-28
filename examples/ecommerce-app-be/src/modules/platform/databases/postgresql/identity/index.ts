import {
    PersonEntity
} from "./entities/person.entity"
import {
    PostgresPrimaryClient
} from "./primary.client"
import {
    InjectPrimaryEntityManager
} from "./primary.decorators"
import {
    PostgresqlPrimaryModule
} from "./primary.module"
export { PersonEntity, PostgresPrimaryClient, InjectPrimaryEntityManager, PostgresqlPrimaryModule }
