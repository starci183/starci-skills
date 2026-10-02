import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the {{name}} read-model table. */
export class Create{{Name}}Projection{{epochMs13}} implements MigrationInterface {
    name = "Create{{Name}}Projection{{epochMs13}}"

    /** Creates the table. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE {{nameSnake}} (
    id uuid PRIMARY KEY
)`)
    }

    /** Drops the table. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE {{nameSnake}}`)
    }
}
