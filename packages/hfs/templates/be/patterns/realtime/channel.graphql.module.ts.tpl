import { Module } from "@nestjs/common"
import { @@Channel@@Subscription } from "./@@channel@@.subscription"

@Module({ providers: [@@Channel@@Subscription] })
/** The GraphQL transport of the @@channel@@ channel: its subscription door; the hub comes from the app's realtime capability. */
export class @@Channel@@GraphqlModule {}
