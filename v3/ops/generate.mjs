import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ops } from './contracts.mjs';
import './verification-contracts.mjs';
import './resources-contracts.mjs';
import './delivery-contracts.mjs';

export const root = path.dirname(fileURLToPath(import.meta.url));
const differences = {
  'workspace.bind':'Verified repository/work-root resource replaces route/session receipt; explicit supplied identity can ground a new workspace.',
  'environment.preflight':'Only selected op prerequisites; no mandatory whole-chain preflight or repairing effects.',
  'business.decide':'Business leaves and detailed FR/NFR/BR/AC matrices replace business head/model/history; no repeated restatement approval.',
  'architecture.decide':'Concrete repository/path/symbol code-scope is required; no automatic critique dispatch or unconditional selection confirmation.',
  'backend.plan':'Filesystem implementation leaves replace duplicate units/response partition; no fan-out execution.',
  'backend.generate':'One bounded outcome, ordinary repository ownership and real per-piece commits; no mandatory session request, one-commit limit or source widening.',
  'interface.plan':'Surface/state leaves and canonical shell ownership; no duplicate units list or forced shell when none applies.',
  'interface.draw':'Requested actual visual direction only; no forced image generation for every UI task or automatic generate handoff.',
  'interface.generate':'Code plus actual captured/inspected result in one selected outcome; no compulsory candidate/session/three-receipt chain.',
  'interface.fix':'Observed defect, bounded ownership and regression proof; no arbitrary universal file-count rule.',
  'interface.audit':'Real UI proof on selected scope; available browser tools instead of mandatory legacy walk runner; no source repairs.',
  'uat.plan':'Canonical flow/UI/UX leaves hold executable expected cases; no duplicate request/case-sheet/units chain.',
  'uat.verify':'Real UI behavior and persistence; explicit actor/fixture refs and immutable evidence bundles replace duplicated run/latest/history files.',
  'api.verify':'Actual API suite and isolated effects; no automatic blanket cleanup or invented missing cases.',
  'quality.verify':'Exact actual commands/metrics; no fabricated project-wide pass or blanket E2E approval loop.',
  'data.plan':'Shared fixture resource owns inputs/namespace/cleanup contract; expected outcomes cannot be seeded.',
  'data.seed':'Exact selected inspect/apply/cleanup action; no account creation, broad restore or automatic next UAT.',
  'identity.provision':'Explicit inspect/create/repair/rotate scope; UAT permission alone never creates/resets accounts; canonical sealed refs.',
  'runtime.serve':'Owned runtime resource and real served-build proof; no universal fixed port, automatic merge or runtime ladder chain.',
  'service.operate':'One declared auxiliary service and actual probes; no inferred ownership or unrelated lifecycle effects.',
  'migration.release':'Exact source-owned migration and target authority; no automatic down/retry/deploy; actual journal invariants.',
  'release.deploy':'Immutable artifact with actual authority/probes; quality success is not deployment authorization.',
  'git.publish':'Exact requested remote/ref effects and per-repo lineage; no session lifecycle prerequisite or automatic cleanup.',
  'library.update':'Selected owner/consumer/pack/publish mode with actual integrity; no default patch bump or implicit registry publication.',
  'content.generate':'Selected grounded content outcome and actual media/example checks; no forced independent reviewer or default edition assumptions.',
  'landing.compose':'Truthful section/content/asset/motion contract, no mandatory legacy Grammar/tool or subsequent generation.',
  'knowledge.repair':'Canonical evidence-backed owner repair with mirror and real tests; no automatic originating-op retry.',
  'business.reconcile':'Current requirement-to-code/evidence comparison, no duplicate head/index/object publication or rewritten expected behavior.',
  'workflow.verify':'Selected peer/piece proof versus task purpose, not terminal v2 solo-session receipts or automatic peer messaging.'
};
const viDifferences = {
  'workspace.bind':'Resource repo/work-root thay receipt route/session; workspace mới có thể dựa identity người dùng cung cấp rõ.',
  'environment.preflight':'Chỉ prerequisite op được chọn; không preflight cả chain hoặc tự sửa.',
  'business.decide':'Lá nghiệp vụ và ma trận FR/NFR/BR/AC thay model/head/history; không duyệt restatement lặp.',
  'architecture.decide':'Có code-scope repo/path/symbol cụ thể; không tự dispatch critique hoặc ép duyệt mọi lựa chọn.',
  'backend.plan':'Lá implementation trong cây thay units/response trùng; không tự fan-out.',
  'backend.generate':'Một outcome hữu hạn, owner repo thật, commit theo piece; không ép session request/một commit/op/ghi rộng.',
  'interface.plan':'Lá surface/state và owner shell canonical; không units trùng hoặc ép shell không cần.',
  'interface.draw':'Chỉ direction visual được yêu cầu; không ép sinh ảnh mọi UI hoặc tự gọi generate.',
  'interface.generate':'Code và ảnh render thật đã xem cho outcome chọn; không chain candidate/session/ba receipt bắt buộc.',
  'interface.fix':'Lỗi quan sát, ownership hữu hạn và proof regression; không luật số file toàn cục tùy ý.',
  'interface.audit':'Proof UI thật đúng scope, dùng browser tool sẵn thay ép runner legacy; không sửa source.',
  'uat.plan':'Lá flow/UI/UX canonical giữ expected case chạy được; không chain request/case-sheet/units trùng.',
  'uat.verify':'Behavior UI/persistence thật; actor/fixture ref rõ, bundle proof bất biến thay run/latest/history trùng.',
  'api.verify':'Suite API thật, effect cách ly; không tự cleanup rộng hoặc bịa case thiếu.',
  'quality.verify':'Command/metric thật chính xác; không claim cả project sai hoặc vòng duyệt E2E mọi lần.',
  'data.plan':'Resource fixture chung sở hữu input/namespace/cleanup; không seed outcome đang test.',
  'data.seed':'Action inspect/apply/cleanup được chọn chính xác; không tạo account/restore rộng/tự UAT tiếp.',
  'identity.provision':'Scope inspect/create/repair/rotate rõ; quyền UAT không tự cho create/reset; sealed refs canonical.',
  'runtime.serve':'Resource runtime sở hữu và proof build serve thật; không fixed port/merge tự động/ladder chain toàn cục.',
  'service.operate':'Một dịch vụ phụ trợ đã khai/probe thật; không suy owner hoặc effect lifecycle khác.',
  'migration.release':'Migration source-owned/target có quyền chính xác; không tự down/retry/deploy; invariant journal thật.',
  'release.deploy':'Artifact bất biến/quyền/probe thật; quality pass không là quyền deploy.',
  'git.publish':'Effect remote/ref đúng yêu cầu, lineage theo repo; không prerequisite session/cleanup tự động.',
  'library.update':'Mode owner/consumer/pack/publish được chọn và integrity thật; không tự bump patch/publish registry.',
  'content.generate':'Outcome content có nguồn, check media/ví dụ thật; không ép reviewer độc lập/edition mặc định.',
  'landing.compose':'Contract section/content/asset/motion trung thực; không ép Grammar/tool legacy/generate tiếp.',
  'knowledge.repair':'Sửa owner canonical từ evidence, mirror/test thật; không tự retry op gốc.',
  'business.reconcile':'So requirement–code/evidence hiện tại; không publish head/index/object trùng hay đổi expected.',
  'workflow.verify':'Proof peer/piece được chọn so purpose task; không receipt solo-session v2 hoặc tự nhắn peer.'
};
const clean = value => String(value).replaceAll('|','\\|').replaceAll('\n',' ');
function supportingReferences(op) {
  const refs=[];
  if(['backend.plan','backend.generate','architecture.decide'].includes(op.id)) refs.push({path:'knowledge/patterns/be/INDEX.md',when:'Only when the selected backend actually uses the documented NestJS family; inspect actual current code before adopting a topic. This is a topic index, not v2 routing.',whenVi:'Chỉ khi backend đã chọn thật sự dùng họ NestJS được mô tả; inspect code hiện tại trước áp dụng topic. Đây là index chuyên môn, không routing v2.'});
  if(['interface.plan','interface.generate','interface.fix','library.update'].includes(op.id)) refs.push({path:'knowledge/patterns/fe/INDEX.md',when:'Only when the selected frontend/library actually adopts this family; retain the current repository convention when it differs.',whenVi:'Chỉ khi FE/thư viện chọn thật sự dùng họ này; giữ convention repo hiện tại nếu khác.'});
  if(['interface.plan','interface.draw','interface.generate','landing.compose'].includes(op.id)) refs.push({path:'knowledge/ui/composition/INDEX.md',when:'Read matching composition topics only for the selected design family and scope; do not import a missing Grammar component or legacy receipt requirement.',whenVi:'Chỉ đọc topic composition khớp family/scope; không import component Grammar không có hoặc yêu cầu receipt legacy.'});
  if(['interface.generate','interface.fix'].includes(op.id)) refs.push({path:'knowledge/ui/presentation/INDEX.md',when:'Read matching presentation topics when the selected installed component/token family is bound. Never invent a rule ID or API from this index.',whenVi:'Đọc topic presentation khớp khi đã gắn họ component/token cài thật; không bịa rule ID/API từ index.'});
  if(['interface.audit','uat.verify','interface.draw'].includes(op.id)) refs.push({path:'knowledge/ui/proof/INDEX.md',when:'Read relevant observation topics for the selected assertions; use only applicable accepted criteria, actual measurements and available instruments, not old run-chain machinery.',whenVi:'Đọc topic observation phù hợp assertion chọn; chỉ dùng tiêu chí đã chấp nhận áp dụng/measurement thật/công cụ có sẵn, không machinery chain cũ.'});
  if(op.id==='knowledge.repair') refs.push({path:'UPDATE.md',when:'Read fully before changing canonical knowledge, IDs, mirrors or generators.',whenVi:'Đọc đầy đủ trước đổi knowledge canonical, ID, mirror hoặc generator.'});
  return refs;
}
const table = (headers, rows) => '| '+headers.map(clean).join(' | ')+' |\n| '+headers.map(()=> '---').join(' | ')+' |\n'+rows.map(row=>'| '+row.map(clean).join(' | ')+' |').join('\n')+'\n';
function document(op, language) {
  const vi=language==='vi';
  const t = x=>x[language];
  let result=`# ${op.id}\n\n${vi?'Bản đối chiếu cho người đọc; bản tiếng Anh là thẩm quyền runtime.':'English runtime authority; generated from the maintained operator authoring sources.'}\n\n`;
  result+=`${vi?'Đọc đầy đủ [giao thức chung](common.md) và tài liệu này trước khi làm.':'Read [the common protocol](common.md) and this document completely before acting.'}\n\n`;
  result+=`## ${vi?'Mục tiêu cụ thể':'Specific goal'}\n\n${t(op.goal)}\n\n`;
  result+=`${vi?'Kind/profile':'Kind/profile'}: \`${op.completionProfile}\`. ${vi?'Chọn node cụ thể từ request hiện tại; không tự chạy toàn cây.':'Select exact target nodes from the current request; never run the whole tree automatically.'}\n\n`;
  result+=`## ${vi?'Graph trong .work, không nằm trong op':'The graph lives in .work, not in the op'}\n\n`;
  result+=op.graphPolicy.mode==='selected-scope-only'
    ? `${vi?'Op này chỉ được khai/sửa graph thuộc scope đang được chọn rõ: dependsOn là node prerequisite cần done; refs là input ngữ nghĩa không tự chặn thực thi. Ghi quan hệ thật vào .work trước review; không tạo chain bắt buộc cho mọi business.':'This op may declare/change only its explicitly selected scope graph: dependsOn names prerequisite nodes that must be done; refs bind semantic inputs without gating execution. Write actual relationships into .work before review, never a mandatory chain for every business.'}\n\n`
    : `${vi?'Chỉ đọc graph node đã chọn. Không thêm/bỏ dependency, refs, required hoặc mở rộng scope để chạy/pass. Prerequisite thiếu/chưa done thì báo ID và dừng piece; nếu cần đổi graph, đề xuất scope update được chọn riêng. Không tự gọi op prerequisite.':'Read the selected node graph only. Do not add/remove dependencies, refs, required flags or scope to run/pass. If a prerequisite is missing/not done, report its ID and stop the piece; propose a separately selected scope update if needed. Never dispatch a prerequisite op.'}\n\n`;
  result+=`## ${vi?'Đầu vào phải đọc và nguồn thẩm quyền':'Required reads and grounding authority'}\n\n`+table(['ID',vi?'Đọc ở đâu':'Read location',vi?'Đọc gì / vì sao':'Content / authority'],op.reads.map(r=>[r.id,r.path,t(r.purpose)]))+'\n';
  const refs=supportingReferences(op);
  if(refs.length) result+=`## ${vi?'Tham chiếu chuyên môn có điều kiện':'Conditional domain references'}\n\n`+table([vi?'Nguồn':'Source',vi?'Khi nào đọc':'When to read'],refs.map(ref=>[`[${ref.path}](../../${ref.path})`,vi?ref.whenVi:ref.when]))+'\n';
  result+=`## ${vi?'Ghi gì vào đâu':'Exact writes and field/content matrix'}\n\n`+table(['ID',vi?'Nơi ghi':'Destination',vi?'Trường / section':'Fields / sections',vi?'Nội dung bắt buộc':'Required content'],op.writes.map(w=>[w.id,w.path,w.fields.join('; '),t(w.content)]))+'\n';
  result+=`## ${vi?'Thứ tự thực hiện hữu hạn':'Ordered bounded procedure'}\n\n`+table(['#',vi?'Đọc ID':'Read IDs',vi?'Ghi ID':'Write IDs',vi?'Thực hiện và kiểm tra':'Action and check'],op.steps.map((s,i)=>[i+1,s.reads.join(', ')||'—',s.writes.join(', ')||'—',t(s.action)]))+'\n';
  result+=`## ${vi?'Proof và điều kiện hoàn thành':'Proof and completion requirements'}\n\n`+table(['ID',vi?'Điều phải chứng minh':'Required observation'],op.proofs.map(p=>[p.id,t(p.requirement)]))+'\n';
  result+=`${vi?'Chỉ ghi completion theo core schema sau khi proof thật đạt. Ghi spec trước khi lấy inputDigest; fail/not-run/inconclusive không thành done. Artifact bổ sung phải được liệt kê trong manifest assets và hash bytes thật.':'Only bind completion using the core schema after actual proof passes. Finish specification edits before computing inputDigest; fail/not-run/inconclusive cannot earn done. Supplementary artifacts must be listed in manifest assets and hashed from real bytes.'}\n\n`;
  result+=`## ${vi?'Tác động và giới hạn':'Side effects and ownership boundary'}\n\n`;
  result+=op.sideEffects.length ? op.sideEffects.map(e=>`- ${e}`).join('\n')+'\n\n' : `${vi?'Chỉ metadata/evidence thuộc scope được giao; không mutation product hoặc dịch vụ ngoài.':'Only scoped metadata/evidence writes; no product or external-service mutation.'}\n\n`;
  result+=`${vi?'Danh sách trên mô tả capability, không cấp quyền mới. Chỉ thực hiện effect trong ma trận op này và quyền hiện tại; không ghi ngoài ma trận, tự chạy op tiếp hay tự thêm agent/account/deploy/publish/cleanup chưa chọn. Effect đã được người dùng cho phép đúng phạm vi không cần xin lại chỉ vì đổi op.':'This lists capability, not new authority. Perform only effects explicitly in this op matrix and current authorization; no writes outside the matrix, automatic next op, or unselected agent/account/deploy/publication/cleanup action. Existing explicit authorization for the exact effect is reused rather than re-requested solely because the op changed.'}\n\n`;
  result+=`## ${vi?'Blocker và điểm dừng':'Blockers and stop'}\n\n`+table(['Code',vi?'Điều kiện / thông tin cần':'Condition / missing fact'],op.blockers.map(b=>[b.code,t(b.condition)]))+'\n';
  result+=`${vi?'Thêm các blocker chung trong common.md khi áp dụng. Ghi đúng quan sát và gap owner; không bịa input để tiếp tục. Kết thúc với kết quả/phạm vi/commit/evidence/gap rồi dừng. Op gợi ý tiếp theo không tự thực thi.':'Apply common blockers where relevant. Record the observed gap and owner; never invent an input to proceed. Finish with result, scope, commits, evidence and remaining gap, then stop. A suggested next op is never executed automatically.'}\n\n`;
  const used=[...new Set([...op.reads,...op.writes].flatMap(x=>[...x.path.matchAll(/<([^>]+)>/g)].map(m=>m[1])))];
  result+=`## ${vi?'Resolve placeholder':'Placeholder resolution'}\n\n${vi?'N/E/R theo common.md. Không ghi literal placeholder; path mới phải ghi rõ dự kiến.':'N/E/R are defined in common.md. Never persist literal placeholders; new paths must be explicitly proposed.'}\n\n`+table(['Placeholder',vi?'Nguồn giá trị':'Value source'],used.map(key=>[`<${key}>`,op.placeholders[key]||'UNDEFINED']))+'\n';
  return result.trimEnd()+'\n';
}

export function outputs() {
  const sorted=[...ops].sort((a,b)=>a.id.localeCompare(b.id));
  const catalogue={schema:'work/ops@1',commonDocument:'common.md',ops:sorted.map(op=>({id:op.id,document:op.id+'.md',mirror:op.id+'.vi.md',goal:op.goal.en,nodeKinds:op.nodeKinds,writeScope:op.writes.map(w=>w.path),sideEffects:op.sideEffects,completionProfile:op.completionProfile,supportingReferences:supportingReferences(op),contract:op})),legacyMappings:Object.entries(differences).sort(([a],[b])=>a.localeCompare(b)).map(([legacy,change])=>({legacy,replacement:legacy,disposition:'preserved-scope-replaced-protocol',source:`operators/${legacy.replaceAll('.','-')}/operator.md`,change}))};
  const files=new Map([['catalog.json',JSON.stringify(catalogue,null,2)+'\n']]);
  for(const op of sorted) { files.set(op.id+'.md',document(op,'en')); files.set(op.id+'.vi.md',document(op,'vi')); }
  for(const lang of ['en','vi']) {
    const vi=lang==='vi';
    let text=`# ${vi?'Đối chiếu operator 2.x → 3.0':'Operator 2.x → 3.0 compatibility'}\n\n`;
    text+=`${vi?'Census nguồn thực tế: 29 operator cũ, giữ phạm vi của cả 29. Thêm goal.setup và scope.retire: tổng 31. File cũ chỉ phục vụ audit, không là routing runtime 3.0.':'Observed source census: 29 legacy operators, all 29 purpose scopes preserved. Add goal.setup and scope.retire: 31 total. Legacy source files are audit references, not runtime routing authority.'}\n\n`;
    text+=table([vi?'ID cũ':'Legacy ID',vi?'Op 3.0':'3.0 op',vi?'Scope giữ / giao thức thay':'Preserved scope / replaced protocol'],catalogue.legacyMappings.map(m=>[m.legacy,`[${m.replacement}](${m.replacement}${vi?'.vi':''}.md)`,vi?viDifferences[m.legacy]:m.change]));
    text+=`\n${vi?'Không import verdict/state cũ thành done. Chỉ reuse evidence thật còn đọc được, đúng requirement/source/environment và qua core validation. Không xóa dữ liệu cũ bằng bảng tương thích.':'Do not import legacy verdict/state as done. Reuse only inspectable real evidence bound to current requirement/source/environment and accepted by core validation. Compatibility mapping never deletes legacy data.'}\n`;
    files.set(`compatibility${vi?'.vi':''}.md`,text);
  }
  return files;
}
export function generate({check=false}={}) {
  const failures=[];
  for(const [name,contents] of outputs()) {
    const file=path.join(root,name);
    if(check) { if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==contents) failures.push(name); }
    else fs.writeFileSync(file,contents);
  }
  return failures;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const failures=generate({check:process.argv.includes('--check')});
  if(failures.length) { process.stderr.write('Stale operator outputs: '+failures.join(', ')+'\n');process.exitCode=1; }
  else process.stdout.write(`Operator catalogue/documents ${process.argv.includes('--check')?'current':'generated'}: ${ops.length} ops\n`);
}
