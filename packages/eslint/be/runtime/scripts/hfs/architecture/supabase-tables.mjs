import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const typescript = createRequire(import.meta.url)('typescript');
const CACHE = new Map();

/** A static TypeScript property name, as emitted by `supabase gen types typescript`. */
const propertyName = name => (typescript.isIdentifier(name) || typescript.isStringLiteralLike(name) ? name.text : null);

/** The type-literal members below property `name`, or null when the generated shape is not statically readable. */
const propertyMembers = (members, name) => {
  const property = members.find(member => typescript.isPropertySignature(member) && propertyName(member.name) === name);
  return property?.type && typescript.isTypeLiteralNode(property.type) ? property.type.members : null;
};

/**
 * The lower-case keys of `Database['public']['Tables']` in Supabase's generated TypeScript contract.
 * An absent, malformed or unreadable contract proves no table. The result is cached once per app root.
 */
export function supabaseTablesOf(appRoot) {
  const root = path.resolve(appRoot);
  if (CACHE.has(root)) return CACHE.get(root);
  const tables = new Set();
  const file = path.join(root, 'supabase', 'types', 'database.types.ts');
  try {
    const source = typescript.createSourceFile(file, fs.readFileSync(file, 'utf8'), typescript.ScriptTarget.Latest, true, typescript.ScriptKind.TS);
    if (source.parseDiagnostics.length === 0) {
      const database = source.statements.find(statement => typescript.isTypeAliasDeclaration(statement) && statement.name.text === 'Database');
      const databaseMembers = database && typescript.isTypeLiteralNode(database.type) ? database.type.members : null;
      const publicMembers = databaseMembers ? propertyMembers(databaseMembers, 'public') : null;
      const tableMembers = publicMembers ? propertyMembers(publicMembers, 'Tables') : null;
      if (tableMembers) for (const member of tableMembers) {
        if (!typescript.isPropertySignature(member)) continue;
        const name = propertyName(member.name);
        if (name) tables.add(name.toLowerCase());
      }
    }
  } catch {
    // Missing and unreadable generated contracts are fail-closed: no table is proven.
  }
  CACHE.set(root, tables);
  return tables;
}
