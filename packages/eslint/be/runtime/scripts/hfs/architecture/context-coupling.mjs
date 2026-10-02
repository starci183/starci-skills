import path from 'node:path';
import { contextModelOf } from './context-map.mjs';
import { machineKit } from './machine-ast.mjs';
import { entitiesOf } from './sql-owner.mjs';

/**
 * R160 `context-coupling` (BE_CONTEXT_COUPLING). Bounded contexts are coupled by events only, never by their schema or their code:
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
const REFERENCES = /\bREFERENCES\s+(?:"?[A-Za-z0-9_]+"?\s*\.\s*)?"?([A-Za-z0-9_]+)"?/giu;

export function checkContextCoupling(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts, resolver } = kit;
  const model = contextModelOf(kit, graph);
  const { tables } = entitiesOf(kit, graph);
  const violations = [];
  const seen = new Set();
  const once = (key, violation) => { if (!seen.has(key)) { seen.add(key); violations.push({ ruleId: RULE, ...violation }); } };
  const counts = { relations: 0, foreignKeys: 0, imports: 0 };
  const covered = new Set(); // `${fromRel}|${targetRoot}` pairs a relation already reported, so the import edge is not a second finding

  for (const file of graph.files.values()) {
    if (file.slot !== 'be.persistence' || !file.owner) continue;
    const base = path.posix.basename(file.rel);
    const ownContext = model.contextOfCapability(file.owner.root);
    if (!ownContext) continue;
    const checker = kit.checkerOf(file.sourceFile);
    if (base.endsWith('.entity.ts')) {
      kit.walk(file.sourceFile, node => {
        if (!ts.isDecorator(node) || !ts.isCallExpression(node.expression)) return true;
        const binding = kit.importBinding(checker, node.expression.expression);
        if (binding?.module !== TYPEORM || !RELATIONS.has(binding.name)) return true;
        counts.relations += 1;
        const argument = node.expression.arguments[0];
        const target = argument && (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) && !ts.isBlock(argument.body) ? model.unparen(argument.body) : null;
        if (!target || !(ts.isIdentifier(target) || ts.isPropertyAccessExpression(target))) return true;
        const home = kit.declarationsOf(checker, ts.isPropertyAccessExpression(target) ? target.name : target).map(kit.ownerOfDeclaration).find(Boolean);
        const targetContext = home ? model.contextOfCapability(home.root) : null;
        if (!home || !targetContext || targetContext === ownContext) return true;
        covered.add(`${file.rel}|${home.root}`);
        once(`${file.rel}|${node.getStart()}`, { ...kit.at(file.rel, file.sourceFile, node), message: `A ${binding.name} relation in ${file.owner.root} (context ${ownContext}) targets an entity of ${home.root} (context ${targetContext}); a relation never crosses a context. Keep the other context's id as a plain column and fill a local copy or a projection from its events.`, context: ownContext, targetContext });
        return true;
      });
    }
    if (file.rel.slice(file.owner.root.length + 1).startsWith('persistence/migrations/')) {
      kit.walk(file.sourceFile, node => {
        if (!(ts.isStringLiteralLike(node) || ts.isTemplateExpression(node))) return true;
        const text = ts.isTemplateExpression(node) ? node.head.text + node.templateSpans.map(span => ` ${span.literal.text}`).join('') : node.text;
        for (const match of text.matchAll(REFERENCES)) {
          counts.foreignKeys += 1;
          const entity = tables.get(match[1].toLowerCase());
          const targetContext = entity ? model.contextOfCapability(entity.owner) : null;
          if (!entity || !targetContext || targetContext === ownContext) continue;
          once(`${file.rel}|${node.getStart()}|${match[1]}`, { ...kit.at(file.rel, file.sourceFile, node), message: `A foreign key in ${file.rel} references table ${entity.table} of ${entity.owner} (context ${targetContext}), but this migration belongs to context ${ownContext}; a foreign key never crosses a context. Keep the id as a plain column and validate it through the other context's API or a local copy fed by its events.`, context: ownContext, targetContext, table: entity.table });
        }
        return true;
      });
    }
  }

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
  void resolver;
  return { violations, coverage: { status: 'checked', ...counts } };
}
