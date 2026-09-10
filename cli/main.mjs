#!/usr/bin/env node
import {loadConfig} from '../scripts/config.mjs';
import fs from 'node:fs';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import {inspectStorage,assertNewStoragePath,isLocalOnlyWorkspace} from '../workflows/storage.mjs';
import { distPath, requireDist, readDistJson } from '../core/runtime-root.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const help = `StarCi 3.0 — bounded, local operations
Usage:
  starci workspace init <work-root> --id <workspace-id>
  starci storage <backend-root>
  starci validate <work-root>
  starci tree <work-root>
  starci impact <work-root> <node-or-resource-id>
  starci stale <work-root>
  starci ops
  starci op <op-id>
  starci workflows
  starci workflow <workflow-id>
  starci route <intent>
  starci plan <plan.yaml>
  starci audit-legacy <legacy-root>
Work metadata uses YAML 1.2. No command runs an op,
creates requests/responses, approves work, marks completion, or migrates legacy data.`;

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function exactArgs(args, count) {
  if (args.length !== count || args.some(value => !value || value.startsWith('--'))) throw new Error('Invalid arguments. Use starci --help.');
}

function directory(root) {
  const resolved = path.resolve(root);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Root must be a real directory, not a symbolic link.');
  return resolved;
}

function catalogue() {
  const catalog = readDistJson('ops', 'catalog.json');
  if (catalog.schema !== 'starci/built-ops@1' || !Array.isArray(catalog.ops)) throw new Error('Unsupported operator catalogue.');
  return catalog;
}

function readOperatorDocument(relative) {
  requireDist();
  const opsRoot = distPath('ops');
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Invalid operator document path.');
  const resolved = path.resolve(opsRoot, relative);
  if (!inside(opsRoot, resolved) || !inside(fs.realpathSync(opsRoot), fs.realpathSync(resolved))) throw new Error('Operator document escapes its catalogue.');
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Operator document is not a bounded text file.');
  return fs.readFileSync(resolved, 'utf8');
}

function readPolicyDocument(relative = 'common.json') {
  requireDist();
  const policyRoot = distPath('policy');
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Invalid policy document path.');
  const resolved = path.resolve(policyRoot, relative);
  if (!inside(policyRoot, resolved) || !inside(fs.realpathSync(policyRoot), fs.realpathSync(resolved))) throw new Error('Policy document escapes its root.');
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Policy document is not a bounded text file.');
  return fs.readFileSync(resolved, 'utf8');
}

/** Inventory only: no link following, known credential-path reads, script execution, or verdict import. */
export function auditLegacy(root) {
  const resolved = directory(root);
  const entries = [];
  const warnings = [];
  const pending = [{ absolute: resolved, relative: '' }];
  while (pending.length) {
    const current = pending.pop();
    for (const name of fs.readdirSync(current.absolute).sort()) {
      const relative = current.relative ? `${current.relative}/${name}` : name;
      const absolute = path.join(current.absolute, name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) { entries.push({ path: relative, type: 'link', followed: false }); continue; }
      if (stat.isDirectory()) {
        const excluded = ['.git', 'node_modules', '_local', '_workflows'].includes(name);
        entries.push({ path: relative, type: 'directory', excluded });
        if (!excluded) pending.push({ absolute, relative });
        continue;
      }
      const item = { path: relative, type: stat.isFile() ? 'file' : 'special', bytes: stat.size };
      const sensitive = /(?:account|secret|credential|password|token|kubeconfig|\.env(?:\.|$)|\.enc$)/i.test(relative);
      const raster = /\.(?:png|jpe?g|webp|gif)$/i.test(name);
      if (stat.isFile() && raster && !sensitive && stat.size <= 32 * 1024 * 1024) {
        item.sha256 = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
      }
      item.contentInspected = Boolean(item.sha256);
      entries.push(item);
    }
  }
  return { schema: 'work/legacy-inventory@1', readOnly: true, importedVerdicts: false, entries, warnings,
    limitations: ['Non-image contents and known credential paths are not read; filenames are not a complete secrecy classifier.', 'Links, .git, node_modules and _local are not traversed.', 'Hashes establish byte identity only, never acceptance or secret classification.'] };
}

/** Returns exit code; injectable streams keep executable behavior independently testable. */
export async function main(argv = process.argv.slice(2), io = { out: value => process.stdout.write(value), err: value => process.stderr.write(value) }) {
  const emit = value => io.out(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
  try {
    const [command, ...args] = argv;
    if (!command || ['--help', '-h', 'help'].includes(command)) { emit(help); return 0; }
    if(command==='storage'){exactArgs(args,1);const result=inspectStorage(directory(args[0]));emit(result);return result.newWorkAllowed?0:1;}
    if(command==='plan'){exactArgs(args,1);const plan=parseYaml(fs.readFileSync(args[0],'utf8'));const {propose}=await import('../workflows/lifecycle.mjs');emit(propose(plan.goal,{workRoot:plan.workRoot,repositories:plan.repositories}));return 0;}
    if (command === 'init') {
      if (args.length !== 3 || args[1] !== '--id' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(args[2])) throw new Error('Use starci workspace init <new-work-root> --id <stable-id>.');
      const root = path.resolve(args[0]);
      assertNewStoragePath(root);
      const localOnly=isLocalOnlyWorkspace(root);
      if (fs.existsSync(root)&&!localOnly) throw new Error('Init requires a new root or only reserved _local state; existing Work will not be modified.');
      directory(path.dirname(root));
      loadConfig(undefined, {initialize:true});
      if(!localOnly)fs.mkdirSync(root);
      fs.writeFileSync(path.join(root, 'workspace.yaml'), stringifyYaml({ schema: 'work/workspace@1', id: args[2] }), { flag: 'wx' });
      fs.mkdirSync(path.join(root,'_schema'));
      for(const name of ['work.schema'])fs.writeFileSync(path.join(root,'_schema',name+'.yaml'),stringifyYaml(readDistJson('schemas',name+'.json')));
      fs.writeFileSync(path.join(root,'_schema/work-layout.yaml'),stringifyYaml(readDistJson('schemas','work-layout.json')));
      fs.writeFileSync(path.join(root, '.gitignore'), '_local/\n_workflows/\n', { flag: 'wx' });
      emit({ ok: true, created: root, workspaceId: args[2], productWorkExecuted: false });
      return 0;
    }
    if (command === 'audit-legacy') { exactArgs(args, 1); emit(auditLegacy(args[0])); return 0; }
    if (command === 'impact') {
      exactArgs(args, 2);
      directory(args[0]);
      const { impactWorkspace } = await import('../core/index.mjs');
      const result = impactWorkspace(path.resolve(args[0]), args[1]);
      emit(result);
      return result.ok ? 0 : 1;
    }
    if (command === 'stale') {
      exactArgs(args, 1);
      directory(args[0]);
      const { staleWorkspace } = await import('../core/index.mjs');
      const result = staleWorkspace(path.resolve(args[0]));
      emit(result);
      return result.ok ? 0 : 1;
    }
    if (['workflows','workflow','route'].includes(command)) {
      exactArgs(args,command==='workflows'?0:1);
      const read=name=>readDistJson('workflows',name);
      const catalog=read('catalog.json'),jobs=read('jobs.json'),frontend=read('frontend.json');
      const {validateWorkflowCatalog}=await import('../workflows/select.mjs');
      const checked=validateWorkflowCatalog(catalog,jobs,frontend);
      if(!checked.ok)throw Error(checked.errors.join('; '));
      if(command==='workflows')emit(catalog);
      else {
        // Catalog inspection is not effectful request classification or execution approval.
        const entry=catalog.workflows.find(w=>w.id===args[0]||(command==='route'&&w.intent===args[0]));
        if(!entry)throw Error('Unknown workflow or unresolved intent; inspect workflows before execution');
        const selected={kind:'workflow',...entry,reason:'catalog-inspection'};
        const definition=selected.id===frontend.id?frontend:jobs.workflows.find(w=>w.id===selected.id);
        emit({selection:selected,definition,executed:false});
      }
      return 0;
    }
    if (command === 'ops') {
      exactArgs(args, 0);
      const catalog = catalogue();
      emit({ schema: catalog.schema, ops: catalog.ops });
      return 0;
    }
    if (command === 'op') {
      if(args.length<1||args.length>2) throw new Error('Expected op ID and optional operation mode.');
      const catalog = catalogue();
      const selected = catalog.ops.find(op => op.id === args[0]);
      if (!selected) throw new Error('Unknown op; use work ops to inspect available IDs.');
      const operator = JSON.parse(readOperatorDocument(selected.operator));
      if(args[1]!==undefined) {
        const {selectOperation}=await import('../ops/select.mjs');
        emit(selectOperation(operator,args[1]));
        return 0;
      }
      emit(`Selected op: ${selected.id}. Contract display only; nothing has executed.`);
      emit(readPolicyDocument('common.json'));
      emit(JSON.stringify(operator, null, 2));
      return 0;
    }
    if (command === 'validate' || command === 'tree') {
      exactArgs(args, 1);
      directory(args[0]);
      const { validateWorkspace } = await import('../core/index.mjs');
      const result = validateWorkspace(path.resolve(args[0]));
      if (command === 'validate') emit(result);
      else {
        emit('Derived completion tree (not an execution plan):');
        for (const node of [...result.nodes].sort((a, b) => a.path.localeCompare(b.path))) {
          const relative = path.isAbsolute(node.path) ? path.relative(path.resolve(args[0]), node.path) : node.path;
          const depth = Math.max(0, relative.split(/[\\/]/).filter(Boolean).length - 2);
          emit(`${'  '.repeat(depth)}- ${node.id} [${node.effectiveState}] (${relative})`);
          if (node.blockedBy?.length) emit(`${'  '.repeat(depth + 1)}blocked by: ${node.blockedBy.join(', ')}`);
          if (node.suspensionReasons?.length) emit(`${'  '.repeat(depth + 1)}suspended: ${node.suspensionReasons.map(reason => `${reason.code} (${reason.ids.join(', ')})`).join('; ')}`);
        }
        if (result.errors.length) emit({ errors: result.errors });
        if (result.warnings.length) emit({ warnings: result.warnings });
      }
      return result.ok ? 0 : 1;
    }
    throw new Error('Unknown command. Use starci --help.');
  } catch (error) {
    // Never print file content, stack traces, or JSON parser excerpts containing secret values.
    const message = error instanceof SyntaxError ? 'Malformed metadata JSON; no content echoed.' : String(error.message ?? error);
    io.err(`starci: ${message}\n`);
    return 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
