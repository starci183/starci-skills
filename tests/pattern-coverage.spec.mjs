import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';

/**
 * Coverage matrices, kept honest by discovery rather than by hand.
 *
 * A. knowledge/patterns/{fe,be}/ records: every authored rule maps to an executable check
 *    (a script obligation routed into checks/code-patterns/, an ESLint obligation or an
 *    architecture obligation of model/code-patterns.yaml) or carries an explicit manual
 *    marker with a reason (an authored `check: manual`, a nonempty verification.manual
 *    list, or a profile semanticOnly entry with rationale+guidance).
 * B. .starciwork record classes (model/records.yaml): every class maps to a schema file
 *    plus a runnable validator, or is marked external/embedded with the reason.
 * C. .stacks env/service files: every file under a repository .stacks/ is the manifest,
 *    referenced by the manifest (checks/stacks.mjs bounds-checks each reference), or a
 *    documented artifact. An env/service file nothing references is uncovered.
 *
 * The expected gap sets are asserted exactly: closing a gap or adding a new one both
 * change these lists, so the matrix cannot silently drift.
 */

const root=path.resolve(import.meta.dirname,'..');
const read=relpath=>fs.readFileSync(path.join(root,relpath),'utf8');
const yaml=relpath=>parseYaml(read(relpath));

const catalog=yaml('model/code-patterns.yaml');
const scriptSource=read('scripts/check-scoped-lint.mjs');

// The adapter table of check-scoped-lint.mjs routes script ruleIds into checks/code-patterns/.
const adapters=[...scriptSource.matchAll(/\{profile:'(\w+)',module:'([\w-]+)',entry:'(\w+)',rules:\[([^\]]*)\]\}/g)]
  .map(match=>({profile:match[1],module:match[2],entry:match[3],rules:[...match[4].matchAll(/[A-Z][A-Z0-9_]+/g)].map(item=>item[0])}));
const scriptModuleFor=(profile,ruleIds)=>{
  const hit=adapters.filter(adapter=>adapter.profile===profile&&ruleIds.some(id=>adapter.rules.includes(id)));
  return hit[0]?.module??(profile==='nest'?'nest':profile==='next'?'next':null);
};

// ---------------------------------------------------------------- A. pattern records

const profileForFamily={};
for(const [name,p] of Object.entries(catalog.profiles))
  for(const dir of p.sourceRuleRoots??[])profileForFamily[path.basename(dir)]={name,profile:p};

const matrix=[],uncovered=[],uncorroborated=[];
const recordMatrix=[];
for(const family of ['fe','be']){
  const dir=`knowledge/patterns/${family}`;
  const {name:profileName,profile}=profileForFamily[family]??{};
  assert.ok(profile,`no code-pattern profile claims ${dir}`);
  const obligationOf=new Map(),manualOf=new Map(),boundCheckIds=new Set();
  for(const obligation of profile.obligations??[]){
    for(const id of obligation.sourceRuleIds??[])obligationOf.set(id,obligation);
    for(const id of obligation.mechanical?.check?.ruleIds??[])boundCheckIds.add(id);
  }
  for(const entry of profile.semanticOnly??[])
    for(const id of entry.sourceRuleIds??[])manualOf.set(id,entry);
  for(const file of fs.readdirSync(path.join(root,dir)).filter(name=>name.endsWith('.yaml')).sort()){
    const doc=yaml(`${dir}/${file}`);
    const rules=(doc.rules??[]).filter(rule=>rule&&typeof rule==='object'&&typeof rule.id==='string');
    const rows=[];
    for(const rule of rules){
      const obligation=obligationOf.get(rule.id),semantic=manualOf.get(rule.id);
      const authoredCheck=rule.check==='manual'||rule.check?.kind==='manual'||doc.check==='manual'||doc.check?.kind==='manual';
      const authoredManual=(rule.verification?.manual??[]).length>0;
      let coverage,detail;
      if(obligation){
        const kind=obligation.mechanical?.check?.kind;
        if(kind==='script'){
          const module=scriptModuleFor(profileName,obligation.mechanical.check.ruleIds??[]);
          coverage='script';detail=`${obligation.id} -> checks/code-patterns/${module}.mjs`;
        }else{coverage=kind??'unbound';detail=obligation.id;}
      }else if(semantic){
        assert.ok(semantic.rationale&&semantic.guidance,`${rule.id}: semanticOnly entry ${semantic.id} must carry rationale and guidance`);
        coverage='manual';detail=`${semantic.id}: ${String(semantic.rationale).slice(0,80)}`;
      }else if(authoredCheck||authoredManual){
        coverage='manual';detail=authoredCheck?'check:manual marker':`verification.manual (${rule.verification.manual.length} entries)`;
      }else{
        coverage='uncovered';detail='no obligation, no manual marker';
        uncovered.push(`${family}/${file}:${rule.id}`);
      }
      // An authored automated claim is a promise: it must name a check the profile actually binds.
      for(const claim of rule.verification?.automated??[]){
        const bound=[...boundCheckIds].some(id=>id===claim||id.endsWith(`/${claim}`));
        if(!bound)uncorroborated.push(`${rule.id}:${claim}`);
      }
      rows.push({rule:rule.id,coverage,detail});
      matrix.push(`${family}/${file}\t${rule.id}\t${coverage}\t${detail}`);
    }
    const kindsCovered=new Set(rows.map(row=>row.coverage));
    recordMatrix.push({record:`${family}/${file}`,rules:rules.length,
      dedicatedScript:kindsCovered.has('script'),manual:rules.length===0?'index':kindsCovered.has('manual'),
      uncovered:rows.filter(row=>row.coverage==='uncovered').length});
  }
}

test('every authored pattern rule maps to an executable check or a named manual marker',t=>{
  for(const line of matrix)t.diagnostic(line);
  for(const row of recordMatrix)t.diagnostic(`${row.record}\trules=${row.rules}\tdedicatedScript=${row.dedicatedScript}\tmanual=${row.manual}\tuncovered=${row.uncovered}`);
  assert.deepEqual(uncovered,[],'every rule must be bound by a profile obligation or an explicit manual marker');
});

test('the script-coverage gap is exactly the known set - comment/folder/function/imports/typing records with no dedicated script',async t=>{
  const withoutScript=recordMatrix.filter(row=>row.rules>0&&!row.dedicatedScript).map(row=>row.record).sort();
  assert.deepEqual(withoutScript,[
    'be/architecture-check.yaml','be/folder.yaml','be/function.yaml','be/naming.yaml','be/typing.yaml',
    'fe/architecture-check.yaml','fe/comment.yaml','fe/folder.yaml','fe/function.yaml','fe/imports.yaml'
  ],'a record gaining or losing its dedicated script check updates this list deliberately');
  // The five authored automated claims no profile obligation binds by name stay visible.
  assert.deepEqual([...uncorroborated].sort(),[
    'BE-COMMENT-7:no-ai-symbol','BE-COMMENT-7:no-emoji','BE-COMMENT-7:no-vietnamese',
    'BE-IMPORTS-1:no-self-module-alias','BE-IMPORTS-6:no-nest-logger']);
  // Every script obligation routes to a checker module that exists and exports its adapter.
  for(const adapter of adapters){
    const file=path.join(root,'checks/code-patterns',`${adapter.module}.mjs`);
    assert.ok(fs.existsSync(file),`checks/code-patterns/${adapter.module}.mjs is missing`);
    const loaded=await import(`${new URL(`../checks/code-patterns/${adapter.module}.mjs`,import.meta.url)}`);
    assert.equal(typeof loaded[adapter.entry],'function',`${adapter.module}.mjs must export ${adapter.entry}`);
  }
});

// ---------------------------------------------------------------- B. .starciwork record classes

const records=yaml('model/records.yaml');
const workSchema=yaml('schemas/work.schema.yaml');
const schemaFile=relpath=>fs.existsSync(path.join(root,relpath));
const hasDef=name=>Boolean(workSchema?.$defs?.[name]);

// The declared mapping: record class -> schema artifact(s) and the runnable validator that
// enforces it. `external` marks records that live outside .starciwork by design; `embedded`
// marks records the parent node's own schema carries because no path maps to the class.
const RECORD_CLASS_COVERAGE={
  record:{schemas:['schemas/work.schema.yaml:$defs.node'],validator:'core/index.mjs:validateWorkspace'},
  srs:{schemas:['schemas/work.schema.yaml:$defs.businessSpec','specifications/srs-v3.schema.yaml','specifications/srs-sections.yaml'],validator:'specifications/validate.mjs:validateSpecification + core/index.mjs:validateWorkspace (SRS_BINDING, SRS_GRAPH)'},
  sds:{schemas:['schemas/work.schema.yaml:$defs.architectureSpec','specifications/sds.schema.yaml','specifications/sds-map.yaml'],validator:'specifications/validate.mjs:validateSpecification + core/index.mjs:validateWorkspace (SDS_BINDING, SDS_MAP)'},
  decision:{schemas:['schemas/work.schema.yaml:$defs.businessSpec','specifications/srs-sections.yaml (starci/srs-policy-decision@1)'],validator:'kernel/decision-inputs.mjs:canonicalDecisionInput + specifications/validate.mjs'},
  brand:{schemas:['schemas/work.schema.yaml:$defs.brandSpec'],validator:'core/index.mjs:validateWorkspace (BRAND_REV)'},
  design:{schemas:['schemas/work.schema.yaml:$defs.uiSpec'],validator:'core/index.mjs:validateWorkspace'},
  asset:{schemas:['schemas/work.schema.yaml:$defs.asset','schemas/work.schema.yaml:$defs.nodeAsset'],validator:'core/index.mjs:validateWorkspace'},
  code:{schemas:[],validator:null,external:'repository-bound product source (layout repository:**), verified by the operations of its lane, never a .starciwork file'},
  grammar:{schemas:['schemas/knowledge-source.schema.yaml','schemas/knowledge-rule.schema.yaml'],validator:'scripts/compile-knowledge.mjs (knowledge/grammars/**)',external:'grammar:** package files are product-bound; only the authored knowledge side is tree-checked'},
  evidence:{schemas:['schemas/work.schema.yaml:$defs.evidence'],validator:'core/index.mjs:validateWorkspace'},
  runtime:{schemas:['schemas/work.schema.yaml:$defs.node'],validator:'core/index.mjs:validateWorkspace',embedded:'declared, never written as a file: carried inside the operations node record (records.yaml)'},
  integration:{schemas:['schemas/work.schema.yaml:$defs.integrationDeclaration'],validator:'core/index.mjs:validateWorkspace + integration.verify op'}
};

test('every .starciwork record class maps to a schema and a runnable validator',async t=>{
  const {validateWorkspace}=await import('../core/index.mjs');
  const {validateSpecification}=await import('../specifications/validate.mjs');
  assert.equal(typeof validateWorkspace,'function','the Work tree validator is importable');
  const probe=validateSpecification({});
  assert.equal(probe.ok,false,'the specification validator runs and rejects a malformed spec');
  const rows=[],flagged=[];
  for(const [kind,entry] of Object.entries(records.records)){
    const cover=RECORD_CLASS_COVERAGE[kind];
    if(!cover){rows.push(`${kind}\tUNCOVERED\tno mapping declared in the spec`);flagged.push(`${kind}: no schema/validator mapping declared`);continue;}
    const missingSchema=(cover.schemas??[]).filter(ref=>{
      const [file,def]=ref.split(':');
      if(!schemaFile(file.split(' ')[0]))return true;
      if(def&&!hasDef(def.replace(/^\$defs\./,'')))return true;
      return false;
    });
    const status=cover.external?'external':cover.embedded?'embedded':missingSchema.length?'flagged':'covered';
    const detail=cover.external??cover.embedded??`${(cover.schemas??[]).join(', ')} | ${cover.validator}`;
    rows.push(`${kind}\t${status}\t${detail}`);
    if(status==='flagged')flagged.push(`${kind}: missing ${missingSchema.join(', ')}`);
    if(status!=='external'&&status!=='embedded'&&!cover.validator)flagged.push(`${kind}: schema without a runnable validator`);
  }
  for(const row of rows)t.diagnostic(row);
  assert.deepEqual(flagged,[],'every record class needs a schema and a runnable validator, or an explicit external/embedded marker');
});

// ---------------------------------------------------------------- C. .stacks env/service files

const STACK_SERVICE=/\.(ya?ml|env|enc|json|toml|conf|conf\.template)$/i;
const stackDirs=[];
const findStacks=dir=>{
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const at=path.join(dir,entry.name);
    if(entry.name==='.stacks'&&entry.isDirectory()){stackDirs.push(at);continue;}
    if(entry.isDirectory()&&!['.git','node_modules','.dist','_local'].includes(entry.name))findStacks(at);
  }
};
findStacks(root);

test('every .stacks env/service file is manifest-referenced or an accounted artifact',async t=>{
  const {checkApplicationStacks}=await import('../checks/stacks.mjs');
  assert.equal(typeof checkApplicationStacks,'function','checks/stacks.mjs must export checkApplicationStacks');
  const uncoveredFiles=[],referencedAbsent=[],rows=[];
  for(const dir of stackDirs){
    const manifestFile=path.join(dir,'application-stacks.yaml');
    const manifest=fs.existsSync(manifestFile)?parseYaml(fs.readFileSync(manifestFile,'utf8')):null;
    const refs=new Set();
    const walk=value=>{
      if(typeof value==='string'){if(/^\.stacks\//.test(value))refs.add(value.slice('.stacks/'.length));}
      else if(Array.isArray(value))value.forEach(walk);
      else if(value&&typeof value==='object')Object.values(value).forEach(walk);};
    walk(manifest);
    const files=[];
    const scan=at=>{for(const entry of fs.readdirSync(at,{withFileTypes:true})){const item=path.join(at,entry.name);entry.isDirectory()?scan(item):files.push(item);}};
    scan(dir);
    for(const file of files){
      const relative=path.relative(dir,file).split(path.sep).join('/');
      let coverage;
      if(relative==='application-stacks.yaml')coverage='manifest';
      else if(refs.has(relative))coverage='referenced';
      else if(!STACK_SERVICE.test(relative))coverage='artifact';
      else{coverage='uncovered';uncoveredFiles.push(`${path.relative(root,dir)}/${relative}`);}
      rows.push(`${path.relative(root,dir)}/${relative}\t${coverage}`);
    }
    for(const ref of refs)if(!fs.existsSync(path.join(dir,ref)))referencedAbsent.push(`${path.relative(root,dir)}/${ref}`);
    // Runnable proof: the checker loads and reports on this repository without throwing.
    const result=checkApplicationStacks({repoRoot:path.dirname(dir),environment:'dev'});
    assert.equal(result.schema,'starci/application-stacks-check@1');
  }
  for(const row of rows)t.diagnostic(row);
  for(const ref of referencedAbsent)t.diagnostic(`referenced-but-absent\t${ref}`);
  assert.deepEqual(uncoveredFiles,[],'every env/service file under .stacks/ must be referenced by the manifest (checks/stacks.mjs bounds-checks it) or be a non-service artifact');
});
