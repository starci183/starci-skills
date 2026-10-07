// Supabase database rules (design 4.2, L02-L09). SQL migrations are parsed with libpg-query through
// database-sql.mjs; config, Git history and generated-type checks are split into bounded sibling modules.
import { found, readJson, readText } from './read.mjs';
import { configFindings, parseToml, typesFindings } from './database-config.mjs';
import { defaultGit, migrationShapeFindings } from './database-migrations.mjs';
import { migrationSetPolicyFindings, sqlAnalysis } from './database-sql.mjs';
import { CONFIG_FILE, DB_CONFIG_POLICY, DB_MIGRATION_SHAPE, MIGRATIONS_DIR, TYPES_FILE } from './database-constants.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { eachInOrder } from '../../lib/in-order.mjs';

export { migrationStamp } from './database-migrations.mjs';
export {
  CONFIG_FILE,
  DB_CONFIG_POLICY,
  DB_DEFINER_SAFE,
  DB_DYNAMIC_DDL,
  DB_MIGRATION_SHAPE,
  DB_POLICY_SHAPE,
  DB_RLS_REQUIRED,
  DB_STORAGE_POLICY,
  DB_TYPES_DRIFT,
  TYPES_FILE,
} from './database-constants.mjs';

const declaresSupabaseConnection = (declaration) => ['be', 'fe'].some((side) => (declaration?.sides?.[side]?.connections ?? []).some((connection) => connection?.provider === 'supabase'));

async function configResult(repoRoot, declared) {
  const configText = readText(repoRoot, CONFIG_FILE);
  const config = configText === null ? null : await parseToml(configText);
  if (config === null) return { config, findings: [found(DB_CONFIG_POLICY, CONFIG_FILE, `${CONFIG_FILE} is not readable valid TOML; the config is policy, so it must parse`, {})] };
  return { config, findings: configFindings({ file: CONFIG_FILE, text: configText, toml: config, supabase: declared ?? null }) };
}

async function migrationAnalyses({ repoRoot, migrations, exposed, forceRls, findings }) {
  const analyses = [];
  await eachInOrder(migrations, async (file) => {
    const text = readText(repoRoot, file);
    if (text === null) {
      findings.push(found(DB_MIGRATION_SHAPE, file, `${file} is not a readable SQL file`, {}));
      return;
    }
    const analysis = await sqlAnalysis({ file, text, exposed, forceRls });
    findings.push(...analysis.findings);
    if (analysis.facts) analyses.push({ file, facts: analysis.facts });
  });
  return analyses;
}

/**
 * Judge the Supabase paths in one app. Git and type emission are injected for deterministic specs; this function
 * starts neither Docker nor the Supabase CLI. A full app is judged when it declares a Supabase connection, while
 * lite apps are judged even before their initial Supabase files have all been scaffolded.
 */
export async function checkDatabase({ repoRoot, files, base, git, edition, supabase, emitTypes, now = () => Date.now() } = {}) {
  const findings = [];
  const migrations = files.filter((file) => file.startsWith(`${MIGRATIONS_DIR}/`)).sort(byCodeUnit);
  const declaration = readJson(repoRoot, 'hfs.json');
  const declared = supabase === undefined ? declaration?.supabase : supabase;
  const hasConfig = files.includes(CONFIG_FILE);
  const supabaseConnection = declaresSupabaseConnection(declaration);
  if (!migrations.length && !hasConfig && !files.includes(TYPES_FILE) && !declared && !supabaseConnection && (edition ?? declaration?.edition) !== 'lite') return findings;

  let config = null;
  if (hasConfig) {
    const result = await configResult(repoRoot, declared);
    config = result.config;
    findings.push(...result.findings);
  }

  const apiSchemas = (config?.api?.schemas ?? []).filter((schema) => typeof schema === 'string');
  const exposed = new Set(['public', ...apiSchemas]);
  const forceRls = new Set((declared?.forceRls ?? []).map((name) => (name.includes('.') ? name : `public.${name}`)));
  findings.push(...await migrationShapeFindings({ repoRoot, migrations, git: git ?? defaultGit, base, now }));

  const analyses = await migrationAnalyses({ repoRoot, migrations, exposed, forceRls, findings });
  findings.push(
    ...migrationSetPolicyFindings(analyses),
    ...await typesFindings({ repoRoot, files, emitTypes, declaration: declared }),
  );
  return findings;
}
