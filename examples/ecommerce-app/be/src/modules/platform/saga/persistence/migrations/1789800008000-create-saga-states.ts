import type { MigrationInterface, QueryRunner } from "typeorm"

/** Creates the tables the sagas of a service persist their state and the events they took in. */
export class CreateSagaStates1789800008000 implements MigrationInterface {
    name = "CreateSagaStates1789800008000"

    /** Creates the tables. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE saga_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    saga varchar(100) NOT NULL,
    correlation_id varchar(200) NOT NULL,
    status varchar(16) NOT NULL CHECK (status IN ('running', 'compensating', 'compensated', 'completed')),
    version int NOT NULL CHECK (version >= 1),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_saga_states_saga_correlation UNIQUE (saga, correlation_id)
)`)
        await queryRunner.query(`CREATE TABLE saga_event_claims (
    source varchar(200) NOT NULL,
    event_id varchar(200) NOT NULL,
    claimed_at timestamptz NOT NULL,
    PRIMARY KEY (source, event_id)
)`)
    }

    /** Drops the tables. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE saga_event_claims`)
        await queryRunner.query(`DROP TABLE saga_states`)
    }
}
