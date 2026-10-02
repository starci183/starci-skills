interface OwnedRowInput {
    readonly id: string
}

interface BookingInput extends OwnedRowInput {
    readonly resourceId: string
    readonly startsAt: string
    readonly endsAt: string
}

type OwnedRowParse = { readonly success: true; readonly data: OwnedRowInput } | { readonly success: false }

type BookingParse = { readonly success: true; readonly data: BookingInput } | { readonly success: false }

interface SignInInput {
    readonly email: string
    readonly password: string
}

type SignInParse = { readonly success: true; readonly data: SignInInput } | { readonly success: false }

const UUID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/u
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

/** The bounded UUID schema shared by generated table Server Actions. */
export const rowSchema = {
    safeParse: (input: unknown): OwnedRowParse => {
        if (
            typeof input !== "object" ||
            input === null ||
            !("id" in input) ||
            typeof input.id !== "string" ||
            !UUID.test(input.id)
        ) {
            return { success: false }
        }
        return { success: true, data: { id: input.id } }
    },
}

/** The bounded booking schema: two UUIDs and one valid, increasing UTC interval. */
export const bookingSchema = {
    safeParse: (input: unknown): BookingParse => {
        if (
            typeof input !== "object" ||
            input === null ||
            !("id" in input) ||
            typeof input.id !== "string" ||
            !UUID.test(input.id) ||
            !("resourceId" in input) ||
            typeof input.resourceId !== "string" ||
            !UUID.test(input.resourceId) ||
            !("startsAt" in input) ||
            typeof input.startsAt !== "string" ||
            input.startsAt.length > 64 ||
            !("endsAt" in input) ||
            typeof input.endsAt !== "string" ||
            input.endsAt.length > 64
        ) {
            return { success: false }
        }
        const startsAt = Date.parse(input.startsAt)
        const endsAt = Date.parse(input.endsAt)
        if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt) return { success: false }
        return {
            success: true,
            data: {
                id: input.id,
                resourceId: input.resourceId,
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
            },
        }
    },
}

/** Bounds credentials before a sign-in request reaches Supabase Auth. */
export const signInInputSchema = {
    safeParse: (input: FormData): SignInParse => {
        const email = input.get("email")
        const password = input.get("password")
        if (
            typeof email !== "string" ||
            email.length > 254 ||
            !EMAIL.test(email) ||
            typeof password !== "string" ||
            password.length < 8 ||
            password.length > 256
        ) {
            return { success: false }
        }
        return { success: true, data: { email, password } }
    },
}
