import type { InjectionToken } from "@nestjs/common"

/** What the inbox of one app needs: the connection whose claims table it uses, so every service claims on its own database. */
export interface InboxOptions {
    /** The token of the shared entity manager of the connection that holds the claims table of the app. */
    readonly connection: InjectionToken
}
