import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const e = (when, target, label) => ({ when, target, ...(label ? { label } : {}) });
const op = (ref, on) => ({ kind: 'operator', ref, on });
const choice = (on) => ({ kind: 'choice', on });
const wait = (prompt, approve, reject, on) => ({ kind: 'wait', approval: { prompt, approve, reject }, on });
const terminal = (result) => ({ kind: 'terminal', result });
const analysis = (modes) => ({ kind: 'analysis', on: Object.keys(modes).map((mode) => e({ inputEquals: { mode } }, modes[mode].target, modes[mode].label)) });
const decided = (routes) => Object.entries(routes).map(([decision,target]) => e({ decision }, target, decision));
const qualityEdges = (pass) => decided({ pass, 'in-boundary': 'implement', 'boundary-drift': 'boundary-plan', 'external-blocker': 'blocked' });

const skills = [
  {
    id:'workspace-ready', description:'Initialize or verify Source identity, bootstrap, portable declarations, local routes and worktrees without loading product delivery knowledge.',
    modes:{ initialize:{target:'identity',label:'full initialization'}, hydrate:{target:'routes',label:'hydrate declared routes'}, verify:{target:'route',label:'verify one route only'} },
    options:{},
    states:{
      'analyze-input':null, identity:op('workspace/identity-verify',decided({ready:'bootstrap'})), bootstrap:op('workspace/bootstrap-verify',decided({ready:'declarations'})),
      declarations:op('workspace/declarations-compile',decided({ready:'routes'})), routes:op('workspace/routes-hydrate',decided({ready:'worktree'})),
      worktree:op('workspace/worktree-verify',decided({ready:'route'})), route:op('workspace/route-verify',decided({ready:'complete'})), complete:terminal('complete')
    }
  },
  {
    id:'business-authority', description:'Refresh, publish or reconcile one evidence-backed business feature head and its lifecycle without changing product source.',
    modes:{ refresh:{target:'route',label:'refresh and publish model'}, reconcile:{target:'route-reconcile',label:'reconcile delivered source'} }, options:{},
    states:{
      'analyze-input':null, route:op('workspace/route-verify',decided({ready:'evidence'})), evidence:op('business/evidence-normalize',decided({ready:'model'})),
      model:op('business/model',decided({ready:'model-approval'})),
      'model-approval':wait('Approve the displayed business model revision and lifecycle transition.','OK BUSINESS <hash>','REJECT BUSINESS <hash>',[e({stage:'business.model.review',status:'approved'},'publish'),e({stage:'business.model.review',status:'rejected'},'evidence')]),
      publish:op('business/publish',decided({'direct-plan':'complete','architecture-required':'complete',blocked:'blocked'})),
      'route-reconcile':op('workspace/route-verify',decided({ready:'reconcile'})), reconcile:op('business/reconcile',decided({implemented:'complete',discrepancy:'blocked'})),
      complete:terminal('complete'), blocked:terminal('blocked')
    }
  },
  {
    id:'architecture-decide', description:'Analyze only genuinely difficult cross-system choices, loop on adversarial feedback, and emit a planning handoff without source writes.',
    modes:{ analyze:{target:'route',label:'run architecture analysis'}, skip:{target:'not-needed',label:'ordinary known-shape work'} }, options:{},
    states:{
      'analyze-input':null, route:op('workspace/route-verify',decided({ready:'frame'})), frame:op('architecture/decision-frame',decided({ready:'current'})),
      current:op('architecture/current-state',decided({ready:'alternatives'})), alternatives:op('architecture/alternatives',decided({ready:'challenge'})),
      challenge:op('architecture/decision-challenge',decided({ready:'handoff',revise:'alternatives',blocked:'blocked'})), handoff:op('architecture/decision-handoff',decided({ready:'complete'})),
      complete:terminal('complete'), 'not-needed':terminal('not-needed'), blocked:terminal('blocked')
    }
  },
  {
    id:'backend-delivery', description:'Compose business authority, optional architecture analysis, exact backend approval, implementation and independent quality gates with repair and replan loops.',
    modes:{ deliver:{target:'route',label:'plan and deliver backend source'}, repair:{target:'implement',label:'resume approved in-boundary repair'} },
    options:{ architectureMode:{enum:['auto','required','skip'],description:'Whether hard architecture analysis is required.'}, deploymentMode:{enum:['none','handoff'],description:'Stop after source proof or hand off to deployment.'} },
    states:{
      'analyze-input':null, route:op('workspace/route-verify',decided({ready:'business-evidence'})),
      'business-evidence':op('business/evidence-normalize',decided({ready:'business-model'})), 'business-model':op('business/model',decided({ready:'business-publish'})),
      'business-publish':op('business/publish',decided({'direct-plan':'architecture-choice','architecture-required':'architecture-frame',blocked:'blocked'})),
      'architecture-choice':choice([e({inputEquals:{'options.architectureMode':'required'}},'architecture-frame'),e({inputEquals:{'options.architectureMode':'auto'}},'source-discovery'),e({inputEquals:{'options.architectureMode':'skip'}},'source-discovery')]),
      'architecture-frame':op('architecture/decision-frame',decided({ready:'architecture-current'})), 'architecture-current':op('architecture/current-state',decided({ready:'architecture-alternatives'})),
      'architecture-alternatives':op('architecture/alternatives',decided({ready:'architecture-challenge'})), 'architecture-challenge':op('architecture/decision-challenge',decided({ready:'architecture-handoff',revise:'architecture-alternatives',blocked:'blocked'})),
      'architecture-handoff':op('architecture/decision-handoff',decided({ready:'source-discovery'})),
      'source-discovery':op('architecture/source-discovery',decided({ready:'pattern-bind'})), 'pattern-bind':op('architecture/pattern-bind',decided({ready:'boundary-plan'})),
      'boundary-plan':op('architecture/boundary-plan',decided({ready:'boundary-challenge'})), 'boundary-challenge':op('architecture/boundary-challenge',decided({clean:'boundary-approval',revise:'boundary-plan',blocked:'blocked'})),
      'boundary-approval':wait('Approve the exact backend plan hash and file boundary.','OK BACKEND <hash>','REJECT BACKEND <hash>',[e({stage:'architecture.boundary.review',status:'approved'},'implement'),e({stage:'architecture.boundary.review',status:'rejected'},'boundary-plan')]),
      implement:op('be/implementation',decided({ready:'format','source-drift':'boundary-plan','boundary-drift':'boundary-plan',blocked:'blocked'})), format:op('quality/format',qualityEdges('lint')), lint:op('quality/lint',qualityEdges('typecheck')),
      typecheck:op('quality/typecheck',qualityEdges('build')), build:op('quality/build',qualityEdges('unit')), unit:op('quality/unit-coverage',qualityEdges('integration')),
      integration:op('quality/integration',qualityEdges('e2e')), e2e:op('quality/e2e',qualityEdges('sonar')), sonar:op('quality/sonar',qualityEdges('post-quality')),
      'post-quality':choice([e({inputEquals:{'options.deploymentMode':'none'}},'source-proof'),e({inputEquals:{'options.deploymentMode':'handoff'}},'deployment-handoff')]),
      'source-proof':op('quality/delivery-proof',decided({pass:'business-reconcile',blocked:'blocked'})), 'business-reconcile':op('business/reconcile',decided({implemented:'complete',discrepancy:'blocked'})),
      complete:terminal('complete'), 'deployment-handoff':terminal('handoff'), blocked:terminal('blocked')
    }
  },
  {
    id:'frontend-design-delivery', description:'Merge new flow/layout, block work, feedback, durable learning and cross-surface reconciliation behind explicit input analysis and creative approval loops.',
    modes:{ layout:{target:'preflight',label:'new page or journey'}, block:{target:'block-reconcile',label:'component-impact block'}, feedback:{target:'maintenance-apply',label:'approved source-first maintenance'}, learning:{target:'learning-resolve',label:'resolve queued design learning'}, reconcile:{target:'surface-audit',label:'closed-set cross-surface consistency'} },
    options:{ brainstorm:{enum:['default','multi-direction'],description:'Default direction depth or explicit brainstorm.'} },
    states:{
      'analyze-input':null,
      preflight:op('fe/preflight',[e({stage:'flow.generate',status:'ready'},'journey')]), journey:op('fe/customer-journey',[e({stage:'flow.review',status:'pending'},'flow-approval')]),
      'flow-approval':wait('Approve one exact customer-journey direction.','OK FLOW <id>','REJECT FLOW <id>',[e({stage:'flow.review',status:'approved'},'page-model'),e({stage:'flow.review',status:'rejected'},'journey')]),
      'page-model':op('fe/page-model',[e({stage:'state.generate',status:'ready'},'state')]), state:op('fe/state',[e({stage:'layout.generate',status:'ready'},'layout'),e({stage:'state.result',status:'blocked'},'blocked')]),
      layout:op('fe/layout',[e({stage:'layout.review',status:'pending'},'layout-approval')]),
      'layout-approval':wait('Approve one exact layout direction and complete page set.','OK LAYOUT <id>','REJECT LAYOUT <id>',[e({stage:'layout.review',status:'approved'},'grammar'),e({stage:'layout.review',status:'rejected'},'layout')]),
      grammar:op('fe/grammar-convergence',[e({stage:'source-fit.resolve',status:'ready'},'source-fit'),e({stage:'source-fit.resolve',status:'blocked'},'blocked')]),
      'source-fit':op('fe/source-fit',[e({stage:'principles.compile',status:'ready'},'principles')]),
      principles:op('fe/principle-compile',[e({stage:'requests.review',status:'ready'},'request-choice'),e({stage:'requests.review',status:'blocked'},'blocked')]),
      'request-choice':choice([e({allFacts:['grammar-gap']},'requests'),e({allFacts:['create-required'],noneFacts:['grammar-gap']},'requests'),e({noneFacts:['grammar-gap','create-required']},'implementation')]),
      requests:op('fe/request-emission',[e({stage:'request.result',status:'ready'},'implementation'),e({stage:'request.result',status:'blocked'},'blocked')]),
      implementation:op('fe/implementation',[e({stage:'seed.materialize',status:'ready'},'seed'),e({stage:'code.result',status:'blocked'},'blocked')]),
      seed:op('fe/product-seed',[e({stage:'test.unit',status:'ready'},'unit-test'),e({stage:'seed.result',status:'blocked'},'blocked')]),
      'unit-test':op('test/unit',[e({stage:'test.e2e',status:'ready'},'e2e-test'),e({stage:'code.repair',status:'repair'},'implementation'),e({stage:'test.review',status:'blocked'},'blocked')]),
      'e2e-test':op('test/e2e',[e({stage:'test.ui',status:'ready'},'ui-test'),e({stage:'code.repair',status:'repair'},'implementation'),e({stage:'test.review',status:'blocked'},'blocked')]),
      'ui-test':op('test/ui',[e({stage:'proof.run',status:'ready'},'product-proof'),e({stage:'code.repair',status:'repair'},'implementation'),e({stage:'layout.review',status:'rejected'},'layout'),e({stage:'test.review',status:'blocked'},'blocked')]),
      'product-proof':op('fe/product-proof',[e({stage:'proof.review',status:'complete'},'complete'),e({stage:'code.repair',status:'repair'},'implementation'),e({stage:'layout.review',status:'rejected'},'layout'),e({stage:'proof.review',status:'blocked'},'blocked')]),
      'block-reconcile':op('fe/block-reconcile',decided({reconciled:'complete',blocked:'blocked'})),
      'maintenance-apply':op('fe/maintenance-apply',decided({applied:'learning-request',blocked:'blocked'})), 'learning-request':op('fe/learning-request',decided({recorded:'complete',blocked:'blocked'})),
      'learning-resolve':op('fe/learning-resolve',decided({resolved:'complete',blocked:'blocked'})),
      'surface-audit':op('fe/surface-audit',decided({audited:'authority-approval',blocked:'blocked'})),
      'authority-approval':wait('Approve the smallest durable design authority and closed consumer set.','OK AUTHORITY <hash>','REJECT AUTHORITY <hash>',[e({stage:'fe.authority.review',status:'approved'},'authority-reconcile'),e({stage:'fe.authority.review',status:'rejected'},'surface-audit')]),
      'authority-reconcile':op('fe/authority-reconcile',decided({reconciled:'consumer-align',blocked:'blocked'})), 'consumer-align':op('fe/consumer-align',decided({aligned:'complete',blocked:'blocked'})),
      complete:terminal('complete'), blocked:terminal('blocked')
    }
  },
  {
    id:'quality-readiness', description:'Merge workflow diagnosis, check-only readiness, rule accountability, approved finding repair and debt repayment with measured repair loops.',
    modes:{ diagnose:{target:'diagnose',label:'trace without mutation'}, inventory:{target:'inventory',label:'measure readiness'}, repair:{target:'repair-approval',label:'repair an approved finding'}, debt:{target:'debt',label:'repay approved debt'}, bindings:{target:'bindings',label:'check rule accountability'} }, options:{},
    states:{
      'analyze-input':null, diagnose:op('quality/workflow-diagnose',decided({diagnosed:'complete'})),
      inventory:op('quality/readiness-inventory',decided({green:'complete',findings:'repair-approval'})),
      'repair-approval':wait('Approve one exact measured finding and repair boundary.','OK REPAIR <finding>','REJECT REPAIR <finding>',[e({stage:'quality.repair.review',status:'approved'},'repair'),e({stage:'quality.repair.review',status:'rejected'},'rejected')]),
      repair:op('quality/finding-repair',decided({repaired:'inventory','boundary-drift':'blocked'})), debt:op('quality/debt-repay',decided({closed:'complete',progress:'debt',blocked:'blocked'})),
      bindings:op('quality/rule-binding-check',decided({pass:'complete',fail:'blocked'})), complete:terminal('complete'), rejected:terminal('rejected'), blocked:terminal('blocked')
    }
  },
  {
    id:'deployment', description:'Adopt, deploy, monitor, recover or roll back one declared release through immutable artifacts, provider/runtime evidence and public steady state.',
    modes:{ adopt:{target:'route',label:'adopt missing deployment intent'}, deploy:{target:'route',label:'execute declared release'}, monitor:{target:'monitor',label:'observe existing rollout'}, recover:{target:'recover',label:'repair observed failure'}, rollback:{target:'rollback',label:'restore declared rollback identity'} },
    options:{ reconcileBusiness:{type:'boolean',description:'Reconcile delivery proof into the business head.'} },
    states:{
      'analyze-input':null, route:op('workspace/route-verify',decided({ready:'intent'})), intent:op('deployment/intent-bind',decided({ready:'manifest'})), manifest:op('deployment/manifest-validate',decided({ready:'plan'})),
      plan:op('deployment/execution-plan',decided({execute:'execution-root','approval-required':'approval',blocked:'blocked'})),
      approval:wait('Approve only new host/domain/tenant/project/destructive/rotation deployment boundary.','OK DEPLOY <hash>','REJECT DEPLOY <hash>',[e({stage:'deployment.review',status:'approved'},'execution-root'),e({stage:'deployment.review',status:'rejected'},'rejected')]),
      'execution-root':op('deployment/execution-root-init',decided({ready:'credentials'})), credentials:op('deployment/credential-resolve',decided({ready:'host'})), host:op('deployment/host-prepare',decided({ready:'artifact-build'})),
      'artifact-build':op('deployment/artifact-build',decided({ready:'artifact-publish'})), 'artifact-publish':op('deployment/artifact-publish',decided({ready:'migration'})),
      migration:op('deployment/migration',decided({applied:'domain','not-applicable':'domain',rollback:'rollback',blocked:'blocked'})), domain:op('deployment/domain-reconcile',decided({ready:'rollout'})),
      rollout:op('deployment/rollout',decided({ready:'monitor'})), monitor:op('deployment/monitor',decided({steady:'proof',recover:'recover',rollback:'rollback',blocked:'blocked'})),
      recover:op('deployment/recover',decided({retry:'monitor',rollback:'rollback','approval-required':'approval',blocked:'blocked'})), rollback:op('deployment/rollback',decided({'rolled-back':'proof',blocked:'blocked'})),
      proof:op('deployment/proof',decided({complete:'reconcile-choice',blocked:'blocked'})),
      'reconcile-choice':choice([e({inputEquals:{'options.reconcileBusiness':true}},'business-reconcile'),e({inputEquals:{'options.reconcileBusiness':false}},'complete')]),
      'business-reconcile':op('business/reconcile',decided({implemented:'complete',discrepancy:'blocked'})), complete:terminal('complete'), rejected:terminal('rejected'), blocked:terminal('blocked')
    }
  },
  {
    id:'platform-services', description:'Reconcile bounded Cloudflare tunnel, business and generated-contract indexing, Sonar or observability services without inheriting product ownership.',
    modes:{ tunnel:{target:'tunnel-plan',label:'one HTTP tunnel/DNS route'}, mcp:{target:'mcp-config',label:'business and generated-contract index'}, sonar:{target:'sonar',label:'shared Sonar enforcement'}, observability:{target:'observability',label:'metrics collection/remote write'} },
    options:{ publishPublic:{type:'boolean',description:'Publish MCP through the declared public boundary.'}, ensureTunnel:{type:'boolean',description:'Reconcile a tunnel before MCP publication.'} },
    states:{
      'analyze-input':null, 'tunnel-plan':op('platform/tunnel-plan',decided({ready:'tunnel-apply'})), 'tunnel-apply':op('platform/tunnel-apply',decided({proved:'complete',blocked:'blocked'})),
      'mcp-config':op('platform/mcp-config',decided({ready:'source-index'})), 'source-index':op('platform/source-index',decided({ready:'mcp-publish-choice'})),
      'mcp-publish-choice':choice([e({inputEquals:{'options.publishPublic':false}},'complete'),e({inputEquals:{'options.publishPublic':true,'options.ensureTunnel':false}},'mcp-publish'),e({inputEquals:{'options.publishPublic':true,'options.ensureTunnel':true}},'mcp-tunnel-plan')]),
      'mcp-tunnel-plan':op('platform/tunnel-plan',decided({ready:'mcp-tunnel-apply'})), 'mcp-tunnel-apply':op('platform/tunnel-apply',decided({proved:'mcp-publish',blocked:'blocked'})),
      'mcp-publish':op('platform/mcp-publish',decided({proved:'complete',blocked:'blocked'})), sonar:op('platform/sonar-service-reconcile',decided({proved:'complete',blocked:'blocked'})),
      observability:op('platform/observability-reconcile',decided({proved:'complete',blocked:'blocked'})), complete:terminal('complete'), blocked:terminal('blocked')
    }
  },
  {
    id:'conversation-provenance', description:'Record or query provider-neutral conversation provenance without committing raw transcripts or secrets.',
    modes:{ record:{target:'record',label:'append immutable snapshot head'}, query:{target:'query',label:'read provenance index'} }, options:{},
    states:{ 'analyze-input':null, record:op('source/conversation-record',decided({recorded:'complete'})), query:op('source/conversation-query',decided({found:'complete',empty:'complete'})), complete:terminal('complete') }
  }
];

for (const skill of skills) skill.id = `starci-${skill.id}`;
const interfaces = {
  'starci-workspace-ready': ['StarCi Workspace Ready', 'Prepare and verify a routed StarCi workspace'],
  'starci-business-authority': ['StarCi Business Authority', 'Maintain evidence-backed StarCi business truth'],
  'starci-architecture-decide': ['StarCi Architecture Decide', 'Resolve difficult cross-system architecture choices'],
  'starci-backend-delivery': ['StarCi Backend Delivery', 'Plan, implement, and prove backend delivery'],
  'starci-frontend-design-delivery': ['StarCi Frontend Design Delivery', 'Design and deliver complete frontend journeys'],
  'starci-quality-readiness': ['StarCi Quality Readiness', 'Diagnose, repair, and prove delivery readiness'],
  'starci-deployment': ['StarCi Deployment', 'Deploy, monitor, recover, or roll back releases'],
  'starci-platform-services': ['StarCi Platform Services', 'Reconcile shared StarCi platform services'],
  'starci-conversation-provenance': ['StarCi Conversation Provenance', 'Record and query safe conversation provenance']
};
const yamlString = (value) => JSON.stringify(value);

const analysisChecks = {
  'workspace-ready': [
    'Classify initialize, hydrate or single-route verification.',
    'Resolve Source identity, declared routes and exact worktree target before filesystem work.',
    'Reject undeclared absolute paths or a target outside the declared workspace boundary.'
  ],
  'business-authority': [
    'Classify model refresh versus delivered-source reconciliation.',
    'Resolve the feature head, lifecycle state and immutable product evidence references.',
    'Detect whether a new approved business revision is required before downstream planning.'
  ],
  'architecture-decide': [
    'Decide whether the request is a genuinely difficult cross-system choice or ordinary known-shape work.',
    'Resolve the decision question, constraints, current-state evidence and systems inside the boundary.',
    'Use skip only when no material alternative or irreversible tradeoff needs analysis.'
  ],
  'backend-delivery': [
    'Classify fresh delivery versus an already approved in-boundary repair.',
    'Resolve business authority, target module, permitted write roots and evidence freshness.',
    'Choose architecture depth and deployment handoff explicitly; never infer either from prose.'
  ],
  'frontend-design-delivery': [
    'Classify journey/layout, block, maintenance, learning resolution or cross-surface reconciliation.',
    'Resolve the complete page set, customer-journey boundary, source-contract artifact and grammar lock.',
    'Identify which creative decisions require approval and which source paths may be changed.'
  ],
  'quality-readiness': [
    'Classify diagnosis, inventory, approved finding repair, debt repayment or rule-binding audit.',
    'Resolve the measured finding/debt identity and the exact source boundary, if mutation is requested.',
    'Route check-only work away from mutating operators and require approval before repair.'
  ],
  deployment: [
    'Classify adopt, deploy, monitor, recover or rollback against one immutable release identity.',
    'Resolve environment, manifest, artifact, provider/runtime evidence and public endpoint targets.',
    'Flag new external resources, destructive changes, credential rotation or undeclared rollback for approval.'
  ],
  'platform-services': [
    'Classify tunnel, MCP/source index, Sonar or observability reconciliation.',
    'Resolve account/tenant/project identity and distinguish read-only indexing from public mutation.',
    'Evaluate publishPublic and ensureTunnel only on the MCP branch; unused branches load no service context.'
  ],
  'conversation-provenance': [
    'Classify immutable record versus provenance query.',
    'Resolve provider-neutral conversation identity and redacted snapshot/evidence references.',
    'Reject raw transcript payloads, secrets or a query with no bounded provenance target.'
  ]
};

for (const skill of skills) skill.states['analyze-input'] = analysis(skill.modes);
const writeJson = (file,value) => writeFileSync(file,`${JSON.stringify(value,null,2)}\n`);

for (const skill of skills) {
  const directory=path.join(root,skill.id); mkdirSync(directory,{recursive:true});
  const agentDirectory=path.join(directory,'agents'); mkdirSync(agentDirectory,{recursive:true});
  writeJson(path.join(directory,'machine.json'),{$schema:'../machine.schema.json',schemaVersion:6,id:skill.id,start:'analyze-input',states:skill.states});
  const optionProperties=Object.fromEntries(Object.entries(skill.options).map(([name,spec])=>[name,spec.enum?{type:'string',enum:spec.enum}:{type:spec.type??'string'}]));
  const inputSchema={$schema:'https://json-schema.org/draft/2020-12/schema',$id:`https://starci.dev/v6/skills/${skill.id}/input.schema.json`,type:'object',additionalProperties:false,
    required:['schemaVersion','runId','project','mode','requestRef','artifactRefs','evidenceRefs','scope','options'],properties:{schemaVersion:{const:6},runId:{type:'string',minLength:1},project:{type:'string',pattern:'^[a-z0-9][a-z0-9-]*$'},
      mode:{enum:Object.keys(skill.modes)},requestRef:{type:'string',minLength:1},artifactRefs:{type:'array',uniqueItems:true,items:{type:'string',minLength:1}},evidenceRefs:{type:'array',uniqueItems:true,items:{type:'string',minLength:1}},
      scope:{type:'object',additionalProperties:false,required:['targetRefs','writeRoots','externalMutation','approvalRef'],properties:{targetRefs:{type:'array',minItems:1,uniqueItems:true,items:{type:'string',minLength:1}},writeRoots:{type:'array',uniqueItems:true,items:{type:'string',minLength:1}},externalMutation:{type:'boolean'},approvalRef:{type:['string','null'],minLength:1}}},
      options:{type:'object',additionalProperties:false,required:Object.keys(optionProperties),properties:optionProperties}}};
  const outputSchema={$schema:'https://json-schema.org/draft/2020-12/schema',$id:`https://starci.dev/v6/skills/${skill.id}/output.schema.json`,type:'object',additionalProperties:false,
    required:['schemaVersion','runId','skillId','result','finalState','receiptRefs','findings'],properties:{schemaVersion:{const:6},runId:{type:'string',minLength:1},skillId:{const:skill.id},result:{enum:['complete','blocked','handoff','not-needed','rejected']},finalState:{type:'string',minLength:1},receiptRefs:{type:'array',uniqueItems:true,items:{type:'string',minLength:1}},findings:{type:'array',uniqueItems:true,items:{type:'string',minLength:1}}}};
  writeJson(path.join(directory,'input.schema.json'),inputSchema); writeJson(path.join(directory,'output.schema.json'),outputSchema);
  const modeRows=Object.entries(skill.modes).map(([mode,spec])=>`| \`${mode}\` | ${spec.label} | \`${spec.target}\` |`).join('\n');
  const optionRows=Object.entries(skill.options).map(([name,spec])=>`| \`${name}\` | ${spec.enum?spec.enum.map((item)=>`\`${item}\``).join(' / '):`\`${spec.type}\``} | ${spec.description} |`).join('\n')||'| — | — | No additional option is loaded. |';
  const checkRows=analysisChecks[skill.id.replace(/^starci-/,'')].map((item,index)=>`${index+1}. ${item}`).join('\n');
  writeFileSync(path.join(directory,'analyze-input.md'),`# Analyze ${skill.id} input\n\nInput analysis runs before any operator or Qdrant retrieval. Validate the closed invocation, then perform these checks:\n\n${checkRows}\n\nAlso reject an unknown mode, stale or missing authority/evidence identity, ambiguous target, write root outside scope, external mutation without an approval boundary, or option outside the closed schema.\n\n## Modes\n\n| Mode | Meaning | First state |\n| --- | --- | --- |\n${modeRows}\n\n## Options\n\n| Option | Values | Decision effect |\n| --- | --- | --- |\n${optionRows}\n\nAnalysis emits only the normalized scope, classification facts and first state. It does not copy operator knowledge into skill context.\n`);
  writeFileSync(path.join(directory,'input.md'),`# ${skill.id} input\n\nProvide one closed invocation validated by \`input.schema.json\`. Read \`analyze-input.md\` first; classification must select exactly one mode and first state before any operator is loaded.\n`);
  writeFileSync(path.join(directory,'output.md'),`# ${skill.id} output\n\nReturn the terminal result, final state, immutable receipt references and unresolved findings. A handoff is explicit and never mislabeled complete.\n`);
  writeFileSync(path.join(directory,'execute.md'),`# Execute ${skill.id}\n\n1. Validate input and run \`analyze-input\`; exactly one analysis edge must match.\n2. Load only the selected state's operator contract. That operator alone retrieves its declared Qdrant knowledge.\n3. Validate operator input, execute it, validate output, then route through exactly one matching edge.\n4. Pass task-session references between states. Do not persist operator input, output, loaded context, observations, patch plans, or receipts to a run directory. On a loop, reuse approved identities and reload only the re-entered operator.\n5. Wait states stop before irreversible work and accept only the displayed revision/command.\n6. At every terminal state—including blocked, rejected, handoff, and not-needed—validate the final skill result, return the user-facing result, then purge all task-session intermediates. Preserve only explicitly approved product-source or external mutations.\n\n## LOADS\n\n| Alias | Target | Kind | Why |\n| --- | --- | --- | --- |\n| \`@machine\` | \`machine.json\` | file | state, guard, branch, loop, wait and terminal ownership |\n| \`@input-analysis\` | \`analyze-input.md\` | file | classify the invocation before selecting an operator |\n\nNo Qdrant knowledge is loaded at skill scope.\n`);
  writeFileSync(path.join(directory,'SKILL.md'),`---\nname: ${skill.id}\ndescription: ${JSON.stringify(skill.description)}\n---\n\n# ${skill.id}\n\n${skill.description}\n\n## INPUT ANALYSIS\n\nRead \`input.md\`, validate \`input.schema.json\`, then follow \`analyze-input.md\`. The analysis state must select one mode without loading operator knowledge.\n\n## STATE MACHINE\n\nExecute \`machine.json\` through \`execute.md\`. Branches and loops are machine-owned; operators never invoke one another. Stop at wait states for the exact displayed revision and finish only at a terminal state. Operator data is task-session-only; purge all intermediates at every terminal while preserving approved durable mutations.\n\n## LOADS\n\n| Alias | Target | Kind | Why |\n| --- | --- | --- | --- |\n| \`@machine\` | \`machine.json\` | file | executable state-machine graph |\n| \`@analysis\` | \`analyze-input.md\` | file | lazy branch selection before operator load |\n`);
  const [displayName, shortDescription] = interfaces[skill.id];
  writeFileSync(path.join(agentDirectory,'openai.yaml'),`interface:\n  display_name: ${yamlString(displayName)}\n  short_description: ${yamlString(shortDescription)}\n  default_prompt: ${yamlString(`Use $${skill.id} to analyze this request and execute only the required state-machine branch.`)}\n`);
  writeFileSync(path.join(directory,'validate-input.mjs'),`import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';\nexport const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url));\nif(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <artifact.json>');\n`);
  writeFileSync(path.join(directory,'validate-output.mjs'),`import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';\nexport const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>value.result==='complete'&&value.receiptRefs.length===0?['$.receiptRefs: completion requires evidence']:[]);\nif(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');\n`);
}

console.log(`materialized ${skills.length} state-machine skills`);
