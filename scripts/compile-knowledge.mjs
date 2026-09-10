/**
 * Compile authored knowledge YAML into `.dist/knowledge/` JSON.
 * Authored JSON is rejected except the explicit calibration dataset.
 * Example payloads are read as text only — never executed during compile.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../core/yaml.mjs';
import { validateAgainstSchema } from './knowledge-compile/schema.mjs';
import {
  assertInside,
  assertSafeRelative,
  outputRelativeFromSource,
  readRealFile,
  stableStringify,
  stemKey,
  walkFiles
} from './knowledge-compile/paths.mjs';
import {
  projectCodeExample,
  projectCodeExampleCatalog,
  projectKnowledgeTopic
} from './knowledge-compile/project.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadAuthoredSchema(relativeJsonPath) {
  const base = relativeJsonPath.replace(/\.json$/i, '');
  const yamlPath = path.join(root, `${base}.yaml`);
  const yamlSchemaPath = path.join(root, relativeJsonPath.replace(/\.schema\.json$/i, '.schema.yaml'));
  const jsonPath = path.join(root, relativeJsonPath);
  if (fs.existsSync(yamlPath)) return parseYaml(fs.readFileSync(yamlPath, 'utf8'));
  if (fs.existsSync(yamlSchemaPath)) return parseYaml(fs.readFileSync(yamlSchemaPath, 'utf8'));
  if (fs.existsSync(jsonPath)) return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  throw Error(`Missing authored schema for ${relativeJsonPath}`);
}

const knowledgeSourceSchema = loadAuthoredSchema('schemas/knowledge-source.schema.json');
const knowledgeRuleSchema = loadAuthoredSchema('schemas/knowledge-rule.schema.json');
const codeExampleSchema = loadAuthoredSchema('schemas/code-example-manifest.schema.json');
const codeExampleCatalogSchema = loadAuthoredSchema('schemas/code-example-catalog.schema.json');
const schemaRegistry = new Map([
  [knowledgeSourceSchema.$id, knowledgeSourceSchema],
  [knowledgeRuleSchema.$id, knowledgeRuleSchema],
  [codeExampleSchema.$id, codeExampleSchema],
  [codeExampleCatalogSchema.$id, codeExampleCatalogSchema],
  ['starci/code-examples-catalog@1', codeExampleCatalogSchema]
]);

function fail(errors) {
  const message = errors.map(e => (e.path ? `${e.path}: ${e.message}` : e.message || e)).join('; ');
  throw Error(message);
}

function loadSchemaDoc(sourcePath, text, skillRoot) {
  try {
    return parseYaml(text);
  } catch (error) {
    throw Error(`${path.relative(skillRoot, sourcePath).replaceAll('\\', '/')}: ${error.message}`);
  }
}

function validate(doc, schema, label) {
  const checked = validateAgainstSchema(doc, schema, { registry: schemaRegistry });
  if (!checked.ok) fail(checked.errors.map(e => ({ path: `${label}${e.path === '$' ? '' : e.path.slice(1)}`, message: e.message })));
}

/** Map authored topic/branch/example relative paths onto generated public JSON paths. */
function resolveTopicPath(fromOutputRel, topicPath) {
  const safe = assertSafeRelative(topicPath, 'topic path');
  const fromDir = path.posix.dirname(fromOutputRel.replace(/^knowledge\//, ''));
  let joined = path.posix.normalize(fromDir === '.' ? safe : path.posix.join(fromDir, safe));
  if (joined.split('/').includes('..')) throw Error(`Topic path escapes knowledge tree: ${topicPath}`);
  if (joined.endsWith('.yaml')) joined = `${joined.slice(0, -5)}.json`;
  else if (!joined.endsWith('.json')) {
    // Directory-style example refs resolve to INDEX.json
    if (!joined.includes('.')) joined = `${joined}/INDEX.json`;
    else joined = `${joined}.json`;
  }
  joined = joined.replace(/\/index\.json$/i, '/INDEX.json').replace(/^index\.json$/i, 'INDEX.json');
  return `knowledge/${joined}`;
}

function readExampleFiles(exampleDir, knowledgeRoot, manifest) {
  const contents = {};
  const declared = new Set();
  for (const file of manifest.files) {
    const relative = assertSafeRelative(file.path, 'example file path');
    if (declared.has(relative)) throw Error(`Duplicate example file path ${relative}`);
    declared.add(relative);
    const absolute = path.join(exampleDir, ...relative.split('/'));
    assertInside(exampleDir, absolute);
    const { bytes } = readRealFile(absolute, knowledgeRoot);
    contents[relative] = bytes.toString('utf8');
  }
  const entry = assertSafeRelative(manifest.entrypoint, 'entrypoint');
  if (!declared.has(entry) && !Object.hasOwn(contents, entry)) {
    const absolute = path.join(exampleDir, ...entry.split('/'));
    assertInside(exampleDir, absolute);
    if (fs.existsSync(absolute)) {
      const { bytes } = readRealFile(absolute, knowledgeRoot);
      contents[entry] = bytes.toString('utf8');
    }
  }
  for (const testFile of manifest.verification?.tests ?? []) {
    const relative = assertSafeRelative(testFile, 'verification test path');
    const absolute = path.join(exampleDir, ...relative.split('/'));
    assertInside(exampleDir, absolute);
    if (!fs.existsSync(absolute)) throw Error(`Missing example verification file: ${relative}`);
    readRealFile(absolute, knowledgeRoot);
  }
  return contents;
}

/**
 * Compile knowledge sources into a deterministic Map of `.dist`-relative paths → Buffer.
 * @param {{ root?: string, check?: boolean, write?: boolean }} [options]
 */
export function compileKnowledge({ root: skillRoot = root, check = false, write = !check } = {}) {
  const knowledgeRoot = path.join(skillRoot, 'knowledge');
  const distKnowledge = path.join(skillRoot, '.dist', 'knowledge');
  if (!fs.existsSync(knowledgeRoot)) throw Error('knowledge/ is required');
  if (fs.lstatSync(knowledgeRoot).isSymbolicLink()) throw Error('knowledge/ cannot be a symlink');

  const yamlFiles = walkFiles(knowledgeRoot, { root: knowledgeRoot, extensions: ['.yaml'] });
  const jsonFiles = walkFiles(knowledgeRoot, { root: knowledgeRoot, extensions: ['.json'] });

  const byStem = new Map();
  for (const file of yamlFiles) {
    const stem = stemKey(knowledgeRoot, file);
    byStem.set(stem, { kind: 'yaml', file, stem });
  }
  for (const file of jsonFiles) {
    const relative = path.relative(knowledgeRoot, file).replaceAll('\\', '/');
    if (relative !== 'ui/proof/calibration/calibration.json') {
      throw Error(`Authored JSON knowledge is retired: ${relative}; use YAML`);
    }
    const stem = stemKey(knowledgeRoot, file);
    if (byStem.has(stem)) throw Error(`Duplicate authored authority for ${stem}`);
    byStem.set(stem, { kind: 'json', file, stem });
  }

  const outputs = new Map();
  const ruleIds = new Map();
  const exampleIds = new Map();
  const topicIds = new Map();
  const pendingRuleRefs = [];
  const pendingExampleRefs = [];
  const pendingTopicPaths = [];

  const sortedStems = [...byStem.keys()].sort((a, b) => a.localeCompare(b));
  for (const stem of sortedStems) {
    const entry = byStem.get(stem);
    const outRel = outputRelativeFromSource(knowledgeRoot, entry.file);
    if (outputs.has(outRel)) throw Error(`Output collision for ${outRel}`);

    if (entry.kind === 'json') {
      // Sole authored JSON exception: calibration dataset (path enforced above). Pass through as data.
      const { bytes } = readRealFile(entry.file, knowledgeRoot);
      const doc = JSON.parse(bytes.toString('utf8'));
      outputs.set(outRel, Buffer.from(stableStringify(doc)));
      continue;
    }

    const { bytes } = readRealFile(entry.file, knowledgeRoot);
    const doc = loadSchemaDoc(entry.file, bytes.toString('utf8'), skillRoot);
    const label = path.relative(skillRoot, entry.file).replaceAll('\\', '/');

    if (doc?.schema === 'starci/code-example@1') {
      validate(doc, codeExampleSchema, label);
      if (exampleIds.has(doc.id)) throw Error(`Duplicate example id ${doc.id}`);
      exampleIds.set(doc.id, outRel);
      for (const ruleId of doc.relatedRules) pendingRuleRefs.push({ id: ruleId, from: label });
      const exampleDir = path.dirname(entry.file);
      const contents = readExampleFiles(exampleDir, knowledgeRoot, doc);
      const projected = projectCodeExample(doc, contents);
      outputs.set(outRel, Buffer.from(stableStringify(projected)));
      continue;
    }

    if (doc?.schema === 'starci/code-example-catalog@1' || doc?.schema === 'starci/code-examples-catalog@1') {
      validate(doc, codeExampleCatalogSchema, label);
      for (const example of doc.examples) {
        pendingTopicPaths.push({ path: resolveTopicPath(outRel, example.path), from: label, ruleIds: example.relatedRules ?? [] });
        for (const ruleId of example.relatedRules ?? []) pendingRuleRefs.push({ id: ruleId, from: `${label}#${example.id}` });
      }
      const projected = projectCodeExampleCatalog(doc);
      outputs.set(outRel, Buffer.from(stableStringify(projected)));
      continue;
    }

    if (doc?.schema === 'starci/knowledge-source@1') {
      validate(doc, knowledgeSourceSchema, label);
      if (topicIds.has(doc.id)) throw Error(`Duplicate knowledge id ${doc.id}`);
      topicIds.set(doc.id, outRel);
      for (const rule of doc.rules ?? []) {
        if (ruleIds.has(rule.id)) throw Error(`Duplicate rule id ${rule.id}`);
        ruleIds.set(rule.id, outRel);
        for (const related of rule.relatedRules ?? []) pendingRuleRefs.push({ id: related, from: `${label}#${rule.id}` });
        for (const related of rule.relatedExamples ?? []) pendingExampleRefs.push({ id: related, from: `${label}#${rule.id}` });
      }
      for (const topic of doc.topics ?? []) {
        if (typeof topic.path === 'string' && topic.path.trim()) {
          pendingTopicPaths.push({ path: resolveTopicPath(outRel, topic.path), from: label, ruleIds: topic.ruleIds ?? [] });
        }
      }
      for (const branch of doc.branches ?? []) {
        pendingTopicPaths.push({ path: resolveTopicPath(outRel, branch.path), from: label, ruleIds: [] });
      }
      const projected = projectKnowledgeTopic(doc);
      outputs.set(outRel, Buffer.from(stableStringify(projected)));
      continue;
    }

    throw Error(`${label}: unsupported knowledge YAML schema ${doc?.schema ?? '(missing)'}`);
  }

  const textHasRule = (text, id) => text.includes(`"title":${JSON.stringify(`${id} —`)}`)
    || text.includes(`"title": ${JSON.stringify(`${id} —`)}`)
    || new RegExp(`"title"\\s*:\\s*"${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} —`).test(text)
    || text.includes(`"id":${JSON.stringify(id)}`)
    || text.includes(`"id": ${JSON.stringify(id)}`);

  for (const ref of pendingRuleRefs) {
    if (ruleIds.has(ref.id)) continue;
    const found = [...outputs.values()].some(buf => textHasRule(buf.toString('utf8'), ref.id));
    if (!found) throw Error(`Missing rule ref ${ref.id} from ${ref.from}`);
  }

  for (const ref of pendingExampleRefs) {
    if (exampleIds.has(ref.id)) continue;
    const found = [...outputs.values()].some(buf => {
      const text = buf.toString('utf8');
      return text.includes(`"id":${JSON.stringify(ref.id)}`) || text.includes(`"id": ${JSON.stringify(ref.id)}`);
    });
    if (!found) throw Error(`Missing example ref ${ref.id} from ${ref.from}`);
  }

  for (const topic of pendingTopicPaths) {
    if (!outputs.has(topic.path)) throw Error(`Missing topic path ${topic.path} from ${topic.from}`);
    for (const ruleId of topic.ruleIds) {
      if (ruleIds.has(ruleId)) continue;
      const found = textHasRule(outputs.get(topic.path).toString('utf8'), ruleId)
        || [...outputs.values()].some(buf => textHasRule(buf.toString('utf8'), ruleId));
      if (!found) throw Error(`Missing topic ruleId ${ruleId} from ${topic.from}`);
    }
  }

  const stale = [];
  const ownedOutput = relative => relative.startsWith('knowledge/') && relative !== 'knowledge/catalog.json';
  if (check || write) {
    if (fs.existsSync(distKnowledge)) {
      if (fs.lstatSync(distKnowledge).isSymbolicLink()) throw Error('.dist/knowledge cannot be a symlink');
      const visit = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          const file = path.join(dir, entry.name);
          if (entry.isSymbolicLink()) throw Error(`Build target cannot be a symlink: ${file}`);
          if (entry.isDirectory()) visit(file);
          else {
            const relative = path.relative(path.join(skillRoot, '.dist'), file).replaceAll('\\', '/');
            if (!ownedOutput(relative)) continue;
            if (!outputs.has(relative)) {
              if (check) stale.push(relative);
              else if (write) fs.unlinkSync(file);
            }
          }
        }
      };
      visit(distKnowledge);
    }
  }

  for (const [relative, bytes] of outputs) {
    const file = path.join(skillRoot, '.dist', relative);
    if (check) {
      if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes)) stale.push(relative);
      continue;
    }
    if (write) {
      let cursor = path.join(skillRoot, '.dist');
      for (const segment of relative.split('/')) {
        cursor = path.join(cursor, segment);
        if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw Error('Build target cannot be a symlink');
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
  }

  return {
    ok: stale.length === 0,
    files: outputs,
    stale: [...new Set(stale)].sort((a, b) => a.localeCompare(b)),
    counts: {
      stems: outputs.size,
      yaml: sortedStems.filter(s => byStem.get(s).kind === 'yaml').length,
      jsonFallback: sortedStems.filter(s => byStem.get(s).kind === 'json').length,
      rules: ruleIds.size,
      examples: exampleIds.size
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const check = process.argv.includes('--check');
    const result = compileKnowledge({ check, write: !check });
    process.stdout.write(`${JSON.stringify({ ok: result.ok, files: result.files.size, stale: result.stale, counts: result.counts })}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
