// usage-sql.mjs — the SQL of "every token the models handled" over an llm_usage row, spelled once: input + output + cache read + cache write.

/** The sum expression over the four token columns of an llm_usage row; `prefix` is a table alias with its dot (`u.`) or empty. */
export const usageTokensSql = (prefix = '') => ['input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens'].map((column) => `COALESCE(${prefix}${column},0)`).join('+');
