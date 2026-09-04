import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRequest, sessionRootOf } from '../../scripts/validate-request.mjs';
import { validateStep } from '../../scripts/validate-step.mjs';
import { validateAgainst } from '../../scripts/json-schema.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { ROOT, hash, json, schema, git, safeRelative, safePath, baseBytes, baseWorkingBytes, same, resolveCommand, regressionFailed } from '../library-source-apply/validate.mjs';
export { ROOT, hash, same, resolveCommand, regressionFailed };
export const proofEnvironment = (ctx, command) => command.kind === 'npm-script' && command.name === 'test:ci' ? { COVERAGE_BASE_SHA: ctx.base } : {};
export const metadataPaths = (plan) => [...plan.manifests, plan.lockfile];
const packageEntry = (key, name) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`);
const canonical = (value) => value && typeof value === 'object' ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const equalJson = (a, b) => same(canonical(a), canonical(b));
const workspaceKey = (file) => path.posix.dirname(file) === '.' ? '' : path.posix.dirname(file);

export function metadataErrors(plan, oldManifests, newManifests, oldLock, newLock) {
  const errors = [];
  for (const file of plan.manifests) {
    const old = oldManifests[file], current = newManifests[file];
    if (old?.dependencies?.[plan.packageName] !== plan.fromVersion) { errors.push(`old dependency pin does not match: ${file}`); continue; }
    const expected = structuredClone(old); expected.dependencies[plan.packageName] = plan.toVersion;
    if (!equalJson(expected, current)) errors.push(`manifest changed outside the named dependency: ${file}`);
  }
  const remainingOld = structuredClone(oldLock), remainingNew = structuredClone(newLock);
  if (!remainingOld.packages || !remainingNew.packages) return [...errors, 'npm lock requires a packages map'];
  for (const file of plan.manifests) {
    const key = workspaceKey(file);
    if (remainingOld.packages[key]?.dependencies?.[plan.packageName] !== plan.fromVersion || remainingNew.packages[key]?.dependencies?.[plan.packageName] !== plan.toVersion) errors.push(`lock workspace pin differs: ${file}`);
    if (remainingOld.packages[key]?.dependencies) delete remainingOld.packages[key].dependencies[plan.packageName];
    if (remainingNew.packages[key]?.dependencies) delete remainingNew.packages[key].dependencies[plan.packageName];
  }
  const oldEntries = Object.entries(oldLock.packages).filter(([key]) => packageEntry(key, plan.packageName));
  const targetEntries = [];
  for (const [key, value] of Object.entries(newLock.packages)) if (packageEntry(key, plan.packageName)) {
    const original = oldLock.packages[key];
    if (original && equalJson(original, value)) { delete remainingOld.packages[key]; delete remainingNew.packages[key]; continue; }
    if (value.version !== plan.toVersion || value.resolved !== plan.release.tarball || value.integrity !== plan.release.integrity) errors.push(`new lock entry is not the verified release: ${key}`);
    const stripped = structuredClone(value); delete stripped.version; delete stripped.resolved; delete stripped.integrity;
    const identicalMetadata = oldEntries.some(([, old]) => {const source=structuredClone(old);delete source.version;delete source.resolved;delete source.integrity;return equalJson(stripped,source);});
    if (!identicalMetadata) errors.push(`new package metadata changes dependency closure: ${key}`);
    targetEntries.push(key); delete remainingNew.packages[key]; if (original) delete remainingOld.packages[key];
  }
  for (const [key] of oldEntries) if (!newLock.packages[key]) errors.push(`an existing package installation was removed: ${key}`);
  if (!targetEntries.length) errors.push('lock contains no changed verified-release entry');
  if (!equalJson(remainingOld, remainingNew)) errors.push('lock changed another dependency or package-manager option');
  return errors;
}

export async function loadContext(branch, root = ROOT) {
  const requestResult = await validateRequest(root, branch);
  if (requestResult.errors.length) throw new Error(requestResult.errors.join('\n'));
  const request = requestResult.request, plan = request.requirements.plan;
  const errors = validateAgainst(schema(root, 'dependency-plan'), plan, 'plan');
  if (errors.length) throw new Error(errors.join('\n'));
  const session = sessionRootOf(branch);
  const route = json(safePath(session, request.inputs.route, false));
  errors.push(...validateAgainst(schema(root, 'route'), route, 'route'));
  if (errors.length) throw new Error(errors.join('\n'));
  if (route.role !== 'fe' || route.mutationReadiness !== 'ready' || route.gitPolicy.worktreeBranches !== 'session-only') throw new Error('route does not admit a consumer session write');
  if (git(route.checkout.diskPath, ['merge-base', route.sourceHead, plan.base]) !== route.sourceHead) throw new Error('selected base is not a verified descendant of the canonical route');
  if (!request.contexts.some((c) => c.alias === '@workspaces/fe' && c.head === plan.base)) throw new Error('consumer base does not match the frozen context');
  const worktrees = git(route.checkout.diskPath, ['worktree','list','--porcelain']).split(/\r?\n\r?\n/).map((record) => Object.fromEntries(record.split(/\r?\n/).filter(Boolean).map((line) => {const split=line.indexOf(' ');return [line.slice(0,split),line.slice(split+1)];})));
  const matches = worktrees.filter((w) => w.branch === `refs/heads/session/${request.sessionId}`);
  if (matches.length !== 1) throw new Error('exactly one routed worktree must own the consumer session branch');
  const checkout = matches[0].worktree;
  const files = metadataPaths(plan);
  if (new Set(files).size !== files.length) throw new Error('metadata file paths must be distinct');
  for (const file of files) {
    safePath(checkout,file,false);
    if (!route.writeRoots.includes(file)) errors.push(`metadata path lacks exact route write authority: ${file}`);
    if (!baseBytes(checkout,plan.base,file)) errors.push(`metadata must already exist at base: ${file}`);
  }
  for (const file of plan.manifests) if (path.posix.basename(file) !== 'package.json') errors.push('consumer manifest must be package.json');
  if (plan.fromVersion === plan.toVersion) errors.push('dependency version must change');
  if (!safeRelative(plan.regression.file) || files.includes(plan.regression.file) || !baseBytes(checkout,plan.base,plan.regression.file)) errors.push('regression must be an existing unchanged source test');
  const manifest = JSON.parse(baseBytes(checkout,plan.base,'package.json'));
  const requiredScripts = ['test:ci','typecheck','lint:check','build'].filter((name) => manifest.scripts?.[name]);
  if (!manifest.scripts?.['test:ci'] && manifest.scripts?.test) requiredScripts.push('test');
  for (const name of requiredScripts) if (!plan.gates.some((g) => g.command.kind === 'npm-script' && g.command.name === name && g.command.args.length === 0)) errors.push(`missing complete delivery gate: ${name}`);
  if (!requiredScripts.some((name) => name === 'test:ci' || name === 'test')) errors.push('consumer needs a complete test gate');
  if (new Set(plan.gates.map((g)=>g.id)).size !== plan.gates.length || plan.gates.some((g)=>['before','after'].includes(g.id))) errors.push('gate ids must be distinct from regression phases');
  for (const gate of plan.gates) if (gate.command.kind !== 'npm-script' || gate.command.args.length || !manifest.scripts?.[gate.command.name]) errors.push(`gate must use a complete existing root script: ${gate.id}`);
  const artifact = safePath(session,plan.release.artifact,false);
  const integrity = `sha512-${createHash('sha512').update(readFileSync(artifact)).digest('base64')}`;
  if (integrity !== plan.release.integrity) errors.push('release artifact integrity differs from the pinned registry release');
  if (errors.length) throw new Error(errors.join('\n'));
  const ctx = { root, branch, session, request, plan, route, checkout, base:plan.base, packageDir:checkout, manifest, artifact, planHash:hash(JSON.stringify(plan)) };
  const packagedManifest = JSON.parse(archiveFile(ctx,'package/package.json'));
  if (packagedManifest.name !== plan.packageName || packagedManifest.version !== plan.toVersion) throw new Error('verified tarball contains a different package/version');
  return ctx;
}

export const archiveFile = (ctx, file) => execFileSync('tar',['-xOf',ctx.artifact,file],{windowsHide:true,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
export function snapshots(ctx) { return Object.fromEntries(metadataPaths(ctx.plan).map((file)=>[file,hash(readFileSync(safePath(ctx.checkout,file,false)))])); }
export function worktreeErrors(ctx, pristine = false) {
  const files = new Set(metadataPaths(ctx.plan));
  const dirty = git(ctx.checkout,['status','--porcelain=v1','-z','--untracked-files=all','--no-renames']).split('\0').filter(Boolean).map((line)=>line.slice(3));
  const errors=dirty.filter((file)=>pristine || !files.has(file)).map((file)=>`file outside current metadata phase: ${file}`);
  if (pristine && git(ctx.checkout,['rev-parse','HEAD']) !== ctx.base) errors.push('preflight head differs from the selected base');
  if (hash(readFileSync(safePath(ctx.checkout,ctx.plan.regression.file,false))) !== hash(baseWorkingBytes(ctx.checkout,ctx.base,ctx.plan.regression.file))) errors.push('the consumer regression test changed');
  return errors;
}
export function changeErrors(ctx) {
  const oldManifests = Object.fromEntries(ctx.plan.manifests.map((file)=>[file,JSON.parse(baseBytes(ctx.checkout,ctx.base,file))]));
  const newManifests = Object.fromEntries(ctx.plan.manifests.map((file)=>[file,json(safePath(ctx.checkout,file,false))]));
  return metadataErrors(ctx.plan,oldManifests,newManifests,JSON.parse(baseBytes(ctx.checkout,ctx.base,ctx.plan.lockfile)),json(safePath(ctx.checkout,ctx.plan.lockfile,false)));
}

export function installedIdentity(ctx, phase) {
  const identities={};
  let entries;
  if (phase !== 'before') {
    const verbose=execFileSync('tar',['-tvf',ctx.artifact],{encoding:'utf8',windowsHide:true});
    if (verbose.split(/\r?\n/).some((line)=>/^[lh]/.test(line))) throw new Error('release tarball cannot contain linked entries');
    entries=execFileSync('tar',['-tf',ctx.artifact],{encoding:'utf8',windowsHide:true}).split(/\r?\n/).filter((file)=>file && !file.endsWith('/'));
    if (entries.some((file)=>!file.startsWith('package/') || !safeRelative(file.slice(8)))) throw new Error('release tarball has an unsafe package path');
  }
  for (const file of ctx.plan.manifests) {
    const require=createRequire(safePath(ctx.checkout,file,false));
    const packageManifest=require.resolve(`${ctx.plan.packageName}/package.json`);
    const metadata=json(packageManifest), expected=phase==='before'?ctx.plan.fromVersion:ctx.plan.toVersion;
    if (metadata.name!==ctx.plan.packageName || metadata.version!==expected) throw new Error(`consumer resolves wrong package version: ${file}`);
    const resolvedDir=realpathSync(path.dirname(packageManifest));
    if (phase!=='before') for(const entry of entries){const installed=safePath(resolvedDir,entry.slice(8),false);if(hash(readFileSync(installed))!==hash(archiveFile(ctx,entry)))throw new Error(`installed package bytes differ from verified tarball: ${entry}`);}
    identities[file]={name:metadata.name,version:metadata.version,integrity:phase==='before'?null:ctx.plan.release.integrity};
  }
  return identities;
}

export function proofErrors(ctx, proof, phase, finalHashes) {
  const errors=validateAgainst(schema(ctx.root,'dependency-proof'),proof,`proof.${phase}`);
  const command=['before','after'].includes(phase)?ctx.plan.regression.command:ctx.plan.gates.find((g)=>g.id===phase).command;
  if(proof.phase!==phase || proof.base!==ctx.base || proof.planHash!==ctx.planHash || !same(proof.command,command) || proof.commandHash!==resolveCommand(ctx,command).commandHash)errors.push(`proof binding differs: ${phase}`);
  if(!same(proof.environment ?? {},proofEnvironment(ctx,command)))errors.push(`proof coverage base differs: ${phase}`);
  if(proof.regressionHash!==hash(baseWorkingBytes(ctx.checkout,ctx.base,ctx.plan.regression.file)))errors.push('proof did not use the unchanged regression');
  if(proof.outputRef!==`response/artifacts/proofs/${phase}.log`)errors.push('proof log must belong to its phase');
  let output='';try{output=readFileSync(safePath(ctx.branch,proof.outputRef,false),'utf8');}catch{errors.push(`missing proof log: ${phase}`);}
  if(!output.trim() || hash(output)!==proof.outputHash)errors.push(`proof output missing or changed: ${phase}`);
  const expectedHashes=phase==='before'?Object.fromEntries(metadataPaths(ctx.plan).map((file)=>[file,hash(baseWorkingBytes(ctx.checkout,ctx.base,file))])):finalHashes;
  if(!same(proof.files,expectedHashes))errors.push(`stale dependency metadata proof: ${phase}`);
  for(const file of ctx.plan.manifests){const identity=proof.installed?.[file];if(identity?.name!==ctx.plan.packageName || identity?.version!==(phase==='before'?ctx.plan.fromVersion:ctx.plan.toVersion) || (phase!=='before' && identity?.integrity!==ctx.plan.release.integrity))errors.push(`proof installed package mismatch: ${phase}`);}
  if(phase==='before'?(proof.exitCode<=0 || !regressionFailed(output,ctx.plan.regression.assertion)):proof.exitCode!==0)errors.push(`required regression/gate outcome not proved: ${phase}`);
  const start=Date.parse(proof.startedAt),end=Date.parse(proof.finishedAt);if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)errors.push('invalid proof timing');
  return errors;
}

export async function validateDependencyStep(branch,root=ROOT,preflight=false){
  const errors=[];
  try{
    const ctx=await loadContext(branch,root);
    if(preflight){errors.push(...worktreeErrors(ctx,true));installedIdentity(ctx,'before');return{errors};}
    const base=await validateStep(root,branch);errors.push(...base.errors);if(base.response?.status!=='done')return{errors};
    errors.push(...worktreeErrors(ctx,true).filter((e)=>!e.includes('preflight head')), ...changeErrors(ctx));installedIdentity(ctx,'after');
    const delivery=json(path.join(branch,'response/data/dependency.json')),commit=git(ctx.checkout,['rev-parse','HEAD']);
    if(delivery.base!==ctx.base || delivery.commit!==commit || delivery.planHash!==ctx.planHash || !same(base.response.commits,[commit]))errors.push('delivery binding mismatch');
    if(git(ctx.checkout,['rev-list','--parents','-n','1',commit])!==`${commit} ${ctx.base}`)errors.push('dependency delivery must be exactly one single-parent session commit');
    const changed=git(ctx.checkout,['diff','--name-only','--no-renames',ctx.base,commit]).split('\n').filter(Boolean).sort();
    if(!same(changed,metadataPaths(ctx.plan).sort()))errors.push('Git diff changed outside the exact dependency metadata set');
    const hashes=snapshots(ctx);if(!same(delivery.files,hashes))errors.push('delivery metadata hashes differ');
    const phases=['before','after',...ctx.plan.gates.map((g)=>g.id)], refs=phases.map((phase)=>`response/data/proofs/${phase}.json`),logs=phases.map((phase)=>`response/artifacts/proofs/${phase}.log`);
    if(!same([...delivery.proofs].sort(),[...refs].sort())||!same([...(base.response.fields['dependency-proof']??[])].sort(),[...refs].sort())||!same([...(base.response.fields['dependency-log']??[])].sort(),[...logs].sort()))errors.push('response must declare every proof and log');
    const proofs={};for(const phase of phases){const proof=json(path.join(branch,`response/data/proofs/${phase}.json`));proofs[phase]=proof;errors.push(...proofErrors(ctx,proof,phase,hashes));}
    if(Date.parse(proofs.before.finishedAt)>Date.parse(proofs.after.startedAt))errors.push('before proof must precede after proof');
    const md=readFileSync(path.join(branch,'response/changes.md'),'utf8');if(!same((tableUnder(md,'## Files')??[]).map(([file])=>file).sort(),metadataPaths(ctx.plan).sort()))errors.push('changes receipt differs from Git metadata set');
  }catch(error){errors.push(error.message);}return{errors};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const branch=process.argv[2];if(!branch){process.stderr.write('usage: node validate.mjs <branch> [--preflight]\n');process.exitCode=2;}else{const{errors}=await validateDependencyStep(path.resolve(branch),ROOT,process.argv.includes('--preflight'));if(errors.length){process.stderr.write(errors.join('\n')+'\n');process.exitCode=1;}else process.stdout.write('valid dependency.update branch\n');}}
