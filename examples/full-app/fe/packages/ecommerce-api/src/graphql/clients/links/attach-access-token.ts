import { SetContextLink } from "@apollo/client/link/context"
import { contextHeaders } from "./context-headers"

/** Attaches `Authorization: Bearer <access token>` from the app's token source when a session exists; an anonymous call goes out without it. */
export const createAttachAccessTokenLink = (accessToken: () => Promise<string | undefined>) =>
    new SetContextLink(async (context) => {
        const token = await accessToken()
        if (token === undefined) return {}
        return { headers: { ...contextHeaders(context), authorization: `Bearer ${token}` } }
    })
