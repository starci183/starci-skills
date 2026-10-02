import { Args, Resolver, Subscription } from "@nestjs/graphql"
import { CurrentPrincipal, Roles } from "@modules/domain/identity"
import { @@service@@ } from "@@serviceModule@@"
import type { @@Channel@@Frame } from "@@serviceModule@@"
import type { Principal } from "@modules/platform/cqrs"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { @@Channel@@ChangedType } from "./dto/@@channel@@-changed.type"
import { @@Channel@@Input } from "./dto/@@channel@@.input"

@Resolver()
/**
 * The push door of the @@channel@@ channel: it subscribes the client to the topic of the hub and writes nothing. `@@service@@` of
 * the domain module builds the topic from the principal, so a client can only listen to a channel its principal owns; the same
 * module exports the `@@Channel@@Frame` type of what travels on it.
 */
export class @@Channel@@Subscription {
    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    /** The changes pushed as they happen; the topic is built from the principal, so another subscriber receives nothing. */
    @Subscription(() => @@Channel@@ChangedType, {
        name: "@@channelCamel@@Changed",
        resolve: (frame: @@Channel@@Frame): @@Channel@@ChangedType => frame,
    })
    @Roles("member")
    @@channelCamel@@Changed(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: @@Channel@@Input,
    ): AsyncIterable<@@Channel@@Frame> {
        return this.hub.subscribe(@@service@@(principal.id, input.id))
    }
}
