import fs from 'node:fs';
import path from 'node:path';

const CACHE = new Map();

/** A static TypeScript property name, as emitted by `supabase gen types typescript`. */
const propertyName = (typescript, name) => (typescript.isIdentifier(name) || typescript.isStringLiteralLike(name) ? name.text : null);

/** The type-literal members below property `name`, or null when the generated shape is not statically readable. */
const propertyMembers = (typescript, members, name) => {
  const property = members.find(member => typescript.isPropertySignature(member) && propertyName(typescript, member.name) === name);
  return property?.type && typescript.isTypeLiteralNode(property.type) ? property.type.members : null;
};

function addTableNames(typescript, members, tables) {
  if (!members) return;
  for (const member of members) {
    if (!typescript.isPropertySignature(member)) continue;
    const name = propertyName(typescript, member.name);
    if (name) tables.add(name.toLowerCase());
  }
}

function readTableNames(typescript, file, tables) {
  const source = typescript.createSourceFile(file, fs.readFileSync(file, 'utf8'), typescript.ScriptTarget.Latest, true, typescript.ScriptKind.TS);
  if (source.parseDiagnostics.length !== 0) return;
  const database = source.statements.find(statement => typescript.isTypeAliasDeclaration(statement) && statement.name.text === 'Database');
  const databaseMembers = database && typescript.isTypeLiteralNode(database.type) ? database.type.members : null;
  const publicMembers = databaseMembers ? propertyMembers(typescript, databaseMembers, 'public') : null;
  const tableMembers = publicMembers ? propertyMembers(typescript, publicMembers, 'Tables') : null;
  addTableNames(typescript, tableMembers, tables);
}

/**
 * The lower-case keys of `Database['public']['Tables']`, parsed with the architecture context's target compiler.
 * An absent, malformed or unreadable contract proves no table. The result is cached once per app root.
 */
export function supabaseTablesOf(appRoot, typescript) {
  const root = path.resolve(appRoot);
  if (CACHE.has(root)) return CACHE.get(root);
  const tables = new Set();
  const file = path.join(root, 'supabase', 'types', 'database.types.ts');
  try {
    readTableNames(typescript, file, tables);
  } catch {
    // Missing and unreadable generated contracts are fail-closed: no table is proven.
  }
  CACHE.set(root, tables);
  return tables;
}
