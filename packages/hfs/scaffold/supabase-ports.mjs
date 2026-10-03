// supabase-ports.mjs - the local Supabase ports of one lite app, derived from its project name.
// The Supabase CLI default ports (54321-54329) belong to whichever stack starts first, so a scaffolded app never uses them: it
// writes its own port block into supabase/config.toml, one block of ten consecutive ports per project name, so two apps (and a
// proof run beside another stack) never contend. The same name always gets the same block.

/** The first port of the block range and how many blocks it holds (41000-44999); clear of the CLI defaults (543xx) and of the Next dev port. */
const RANGE_START = 41000;
const BLOCK_SIZE = 10;
const BLOCK_COUNT = 400;
/** The offsets inside one block, by config.toml section. */
const OFFSETS = Object.freeze({ shadow: 0, api: 1, db: 2, studio: 3, inbucket: 4, analytics: 7, pooler: 9 });

/** The template variables of the port block: `supabasePort<Name>` for every section above. */
export const SUPABASE_PORT_VARIABLES = Object.freeze(Object.keys(OFFSETS).map((key) => `supabasePort${key[0].toUpperCase()}${key.slice(1)}`));

/** FNV-1a over the project name: stable, dependency-free. */
const hash = (text) => [...text].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** The first port of the project's block. */
export const supabasePortBase = (project) => RANGE_START + (hash(String(project)) % BLOCK_COUNT) * BLOCK_SIZE;

/** { supabasePortApi: '41231', ... }: the variables a skeleton file fills. */
export function supabasePortVars(project) {
  const base = supabasePortBase(project);
  return Object.fromEntries(Object.entries(OFFSETS).map(([key, offset]) => [`supabasePort${key[0].toUpperCase()}${key.slice(1)}`, String(base + offset)]));
}
