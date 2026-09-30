import type { MigrationInterface, QueryRunner } from "typeorm"
import { CREATE_PERSONS_TABLE, DROP_PERSONS_TABLE } from "../schema.sql"

/** Creates the persons table of the identity database. */
export class CreatePersons1789800000000 implements MigrationInterface {
    name = "CreatePersons1789800000000"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(CREATE_PERSONS_TABLE)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(DROP_PERSONS_TABLE)
    }
}
