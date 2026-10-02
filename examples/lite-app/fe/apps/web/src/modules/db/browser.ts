"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../../supabase/types/database.types"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"

/** Creates the browser client with the public key; RLS remains the authority. */
export const createBrowserDbClient = (): SupabaseClient<Database> =>
    createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())
