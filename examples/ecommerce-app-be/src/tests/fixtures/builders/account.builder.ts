import { PersonEntity } from "@modules/domain/account"

/** A registered person row with valid defaults and a fixed creation time; the spec overrides only what matters. */
export const personEntity = (overrides: Partial<PersonEntity> = {}): PersonEntity =>
    Object.assign(
        new PersonEntity(),
        {
            id: "p-1",
            email: "an@shop.test",
            passwordHash: "hash-of-the-password",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        overrides,
    )
