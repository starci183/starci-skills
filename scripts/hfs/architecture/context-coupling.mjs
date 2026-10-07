import path from 'node:path';
import { contextModelOf } from './context-map.mjs';
import { machineKit } from './machine-ast.mjs';
import { entitiesOf } from './sql-owner.mjs';

/**
 * R175 `context-coupling` (BE_CONTEXT_COUPLING). Bounded contexts are coupled by events only, never by their schema or their code:
 *   - an entity relation (`OneToOne`, `OneToMany`, `ManyToOne`, `ManyToMany` imported from typeorm) whose target class is an entity of a capability
 *     of another context is refused;
 *   - a migration foreign key (`REFERENCES <table>` in a string of a migration file) onto a table whose entity belongs to another context is refused;
 *   - a domain or projection file imports no file of a capability of another context (its entities, services or SQL).
 * A capability's context is the connection its persistence arrays are registered on (context-map.mjs). A file or table with no proven context
 * (a platform capability, a capability registered nowhere) is never judged, and the table of a foreign key is looked up through the entities the
 * program declares, never guessed from a name.
 */
export const CONTEXT_COUPLING_RULE_IDS = ['BE_CONTEXT_COUPLING'];

const RULE = 'BE_CONTEXT_COUPLING';
const TYPEORM = 'typeorm';
const RELATIONS = new Set(['OneToOne', 'OneToMany', 'ManyToOne', 'ManyToMany']);
// The table identifier after the SQL keyword REFERENCES, optionally schema-qualified and quoted.
const REFERENCES = /\bREFERENCES\s+(?:"?\w+"?\s*\.\s*)?"?(\w+)"?/giu;

const checkCrossContextImports = (graph, model, covered, counts, once) => {
  for (const edge of graph.edges) {
    const from = graph.files.get(edge.from);
    const to = graph.files.get(edge.to);
    if (!from?.owner || !to?.owner || from.owner.root === to.owner.root) continue;
    const fromContext = model.contextOfFile(edge.from);
    const toContext = model.contextOfFile(edge.to);
    if (!fromContext || !toContext || fromContext === toContext) continue;
    counts.imports += 1;
    if (covered.has(`${edge.from}|${to.owner.root}`)) continue;
    once(`${edge.from}|${edge.to}|${edge.line}`, { path: edge.from, line: edge.line, column: edge.column, message: `${from.owner.root} (context ${fromContext}) imports ${to.owner.root} (context ${toContext}); a context never imports another context's entities, services or SQL. Keep a local copy fed by its events, or read a projection.`, context: fromContext, targetContext: toContext });
  }
};

const relationTarget = (kit, model, argument) => {
  const { ts } = kit;
  const isFunction = argument && (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
  const target = isFunction && !ts.isBlock(argument.body) ? model.unparen(argument.body) : null;
  return target && (ts.isIdentifier(target) || ts.isPropertyAccessExpression(target)) ? target : null;
};

// The relation decorator (`@ManyToOne(() => Target)` imported from typeorm) a node is, with the checker that resolves it, else null.
const relationBinding = (kit, checker, node) => {
  const { ts } = kit;
  if (!ts.isDecorator(node) || !ts.isCallExpression(node.expression)) return null;
  const binding = kit.importBinding(checker, node.expression.expression);
  return binding?.module === TYPEORM && RELATIONS.has(binding.name) ? binding : null;
};

const checkRelations = (scan, file, ownContext) => {
  const { kit, model, counts, covered, once } = scan;
  const { ts } = kit;
  const checker = kit.checkerOf(file.sourceFile);
  kit.walk(file.sourceFile, node => {
    const binding = relationBinding(kit, checker, node);
    if (!binding) return;
    counts.relations += 1;
    const target = relationTarget(kit, model, node.expression.arguments[0]);
    if (!target) return;
    const home = kit.declarationsOf(checker, ts.isPropertyAccessExpression(target) ? target.name : target).map(kit.ownerOfDeclaration).find(Boolean);
    const targetContext = home ? model.contextOfCapability(home.root) : null;
    if (!home || !targetContext || targetContext === ownContext) return;
    covered.add(`${file.rel}|${home.root}`);
    once(`${file.rel}|${node.getStart()}`, { ...kit.at(file.rel, file.sourceFile, node), message: `A ${binding.name} relation in ${file.owner.root} (context ${ownContext}) targets an entity of ${home.root} (context ${targetContext}); a relation never crosses a context. Keep the other context's id as a plain column and fill a local copy or a projection from its events.`, context: ownContext, targetContext });
  });
};

const stringText = (ts, node) => (ts.isTemplateExpression(node) ? node.head.text + node.templateSpans.map(span => ` ${span.literal.text}`).join('') : node.text);

const checkForeignKeys = (scan, file, ownContext) => {
  const { kit, model, tables, counts, once } = scan;
  const { ts } = kit;
  kit.walk(file.sourceFile, node => {
    if (!(ts.isStringLiteralLike(node) || ts.isTemplateExpression(node))) return;
    for (const match of stringText(ts, node).matchAll(REFERENCES)) {
      counts.foreignKeys += 1;
      const entity = tables.get(match[1].toLowerCase());
      const targetContext = entity ? model.contextOfCapability(entity.owner) : null;
      if (!entity || !targetContext || targetContext === ownContext) continue;
      once(`${file.rel}|${node.getStart()}|${match[1]}`, { ...kit.at(file.rel, file.sourceFile, node), message: `A foreign key in ${file.rel} references table ${entity.table} of ${entity.owner} (context ${targetContext}), but this migration belongs to context ${ownContext}; a foreign key never crosses a context. Keep the id as a plain column and validate it through the other context's API or a local copy fed by its events.`, context: ownContext, targetContext, table: entity.table });
    }
  });
};

const checkPersistenceFile = (scan, file) => {
  if (file.slot !== 'be.persistence' || !file.owner) return;
  const ownContext = scan.model.contextOfCapability(file.owner.root);
  if (!ownContext) return;
  if (path.posix.basename(file.rel).endsWith('.entity.ts')) checkRelations(scan, file, ownContext);
  if (file.rel.slice(file.owner.root.length + 1).startsWith('persistence/migrations/')) checkForeignKeys(scan, file, ownContext);
};

export function checkContextCoupling(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const model = contextModelOf(kit, graph);
  const { tables } = entitiesOf(kit, graph);
  const violations = [];
  const seen = new Set();
  const once = (key, violation) => { if (!seen.has(key)) { seen.add(key); violations.push({ ruleId: RULE, ...violation }); } };
  const counts = { relations: 0, foreignKeys: 0, imports: 0 };
  const covered = new Set(); // `${fromRel}|${targetRoot}` pairs a relation already reported, so the import edge is not a second finding
  const scan = { kit, model, tables, counts, covered, once };

  for (const file of graph.files.values()) checkPersistenceFile(scan, file);

  checkCrossContextImports(graph, model, covered, counts, once);
  return { violations, coverage: { status: 'checked', ...counts } };
}
