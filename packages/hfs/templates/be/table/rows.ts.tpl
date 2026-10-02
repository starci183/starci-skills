import type { Database } from "../../../../../../supabase/types/database.types"

/** One generated row of public.{{table}}. */
export type {{Name}}Row = Database["public"]["Tables"]["{{table}}"]["Row"]
