/** The verified caller admitted by Supabase token verification. */
export interface Principal {
    readonly id: string
    readonly role: "authenticated"
}
