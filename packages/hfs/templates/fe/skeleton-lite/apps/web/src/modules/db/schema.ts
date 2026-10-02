interface OwnedRowInput {
    readonly id: string
}

type OwnedRowParse =
    | { readonly success: true; readonly data: OwnedRowInput }
    | { readonly success: false }

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
