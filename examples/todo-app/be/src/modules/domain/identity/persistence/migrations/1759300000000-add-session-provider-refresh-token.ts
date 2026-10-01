import type { MigrationInterface, QueryRunner } from "typeorm"

/** Adds the refresh token of the identity provider session each session row opened; sign-out ends that session with it. */
export class AddSessionProviderRefreshToken1759300000000 implements MigrationInterface {
    name = "AddSessionProviderRefreshToken1759300000000"

    /** Adds the column. */
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS provider_refresh_token text NOT NULL`)
    }

    /** Drops the column. */
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS provider_refresh_token`)
    }
}
