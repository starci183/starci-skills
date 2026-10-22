/** The columns of a registered person row. */
export interface PersonRow {
    /** The person id: the identity provider's subject. */
    id: string
    /** The sign-in email. */
    email: string
    /** When the person registered. */
    createdAt: Date
}

/** A registered person row with valid defaults and a fixed creation time; the spec overrides only what matters. */
export const personRow = (overrides: Partial<PersonRow> = {}): PersonRow => ({
    id: "p-1",
    email: "an@shop.test",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
})
