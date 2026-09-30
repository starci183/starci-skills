import { sql } from "@modules/platform/database"

/** Creates the subscriptions table: exactly one row per person. */
export const CREATE_SUBSCRIPTIONS_TABLE = sql`CREATE TABLE IF NOT EXISTS subscriptions (
    id text PRIMARY KEY,
    person_id text NOT NULL UNIQUE,
    plan text NOT NULL DEFAULT 'free',
    status text NOT NULL DEFAULT 'free',
    period_end timestamptz,
    gateway_customer_id text
)`

/** Indexes the subscription of one person. */
export const CREATE_SUBSCRIPTIONS_PERSON_INDEX = sql`CREATE INDEX IF NOT EXISTS subscriptions_person_id_idx ON subscriptions (person_id)`

/** Creates the payment intents table: the idempotent ledger of the gateway. */
export const CREATE_PAYMENT_INTENTS_TABLE = sql`CREATE TABLE IF NOT EXISTS payment_intents (
    id text PRIMARY KEY,
    subscription_id text NOT NULL,
    gateway text NOT NULL DEFAULT 'sepay',
    gateway_intent_id text NOT NULL,
    amount integer NOT NULL,
    currency text NOT NULL DEFAULT 'VND',
    status text NOT NULL DEFAULT 'pending',
    applied_at timestamptz
)`

/** Indexes the intents of one subscription. */
export const CREATE_PAYMENT_INTENTS_SUBSCRIPTION_INDEX = sql`CREATE INDEX IF NOT EXISTS payment_intents_subscription_id_idx ON payment_intents (subscription_id)`

/** Indexes the intents by the id the gateway knows them under. */
export const CREATE_PAYMENT_INTENTS_GATEWAY_INDEX = sql`CREATE INDEX IF NOT EXISTS payment_intents_gateway_intent_id_idx ON payment_intents (gateway_intent_id)`

/** Drops the payment intents table. */
export const DROP_PAYMENT_INTENTS_TABLE = sql`DROP TABLE IF EXISTS payment_intents`

/** Drops the subscriptions table. */
export const DROP_SUBSCRIPTIONS_TABLE = sql`DROP TABLE IF EXISTS subscriptions`
