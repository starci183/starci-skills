import { SetContextLink } from "@apollo/client/link/context"

/** Attaches `Authorization: Bearer <access token>` from modules/auth when a session exists; an anonymous call goes out without it. */
export const createAttachAccessTokenLink = (accessToken: () => Promise<string | undefined>) =>
    new SetContextLink(async (context) => {
        const token = await accessToken()
        if (token === undefined) return {}
        return { headers: { ...context.headers, authorization: `Bearer ${token}` } }
    })
