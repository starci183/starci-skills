import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ops } from './contracts.mjs';
import './verification-contracts.mjs';
import './resources-contracts.mjs';
import './delivery-contracts.mjs';
import './migration-contract.mjs';

export const root = path.dirname(fileURLToPath(import.meta.url));
const clean = value => String(value).replaceAll('|','\\|').replaceAll('\n',' ');
function supportingReferences(op) {
  const refs=[];
  if(['backend.plan','backend.generate','architecture.decide'].includes(op.id)) refs.push({path:'knowledge/patterns/be/INDEX.md',when:'Only when the selected backend actually uses the documented NestJS family; inspect actual current code before adopting a topic. Use this index only for applicable code patterns.',whenVi:'Chỉ khi backend đã chọn thật sự dùng họ NestJS được mô tả; inspect code hiện tại trước áp dụng topic. Chỉ dùng index cho pattern code áp dụng.'});
  if(['interface.plan','interface.generate','interface.fix','library.update'].includes(op.id)) refs.push({path:'knowledge/patterns/fe/INDEX.md',when:'Only when the selected frontend/library actually adopts this family; retain the current repository convention when it differs.',whenVi:'Chỉ khi FE/thư viện chọn thật sự dùng họ này; giữ convention repo hiện tại nếu khác.'});
  if(['interface.plan','interface.draw','interface.generate','landing.compose'].includes(op.id)) refs.push({path:'knowledge/ui/composition/INDEX.md',when:'Read matching composition topics only for the selected design family and scope; do not import a missing Grammar component or unrelated receipt requirement.',whenVi:'Chỉ đọc topic composition khớp family/scope; không import component Grammar không có hoặc yêu cầu receipt không liên quan.'});
  if(['interface.generate','interface.fix'].includes(op.id)) refs.push({path:'knowledge/ui/presentation/INDEX.md',when:'Read matching presentation topics when the selected installed component/token family is bound. Never invent a rule ID or API from this index.',whenVi:'Đọc topic presentation khớp khi đã gắn họ component/token cài thật; không bịa rule ID/API từ index.'});
  if(['interface.audit','uat.verify','interface.draw'].includes(op.id)) refs.push({path:'knowledge/ui/proof/INDEX.md',when:'Read relevant observation topics for the selected assertions; use only applicable accepted criteria, actual measurements and available instruments, not unselected execution machinery.',whenVi:'Đọc topic observation phù hợp assertion chọn; chỉ dùng tiêu chí đã chấp nhận áp dụng/measurement thật/công cụ có sẵn, không machinery thực thi chưa chọn.'});
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
  const catalogue={schema:'work/ops@1',commonDocument:'common.md',ops:sorted.map(op=>({id:op.id,document:op.id+'.md',mirror:op.id+'.vi.md',goal:op.goal.en,nodeKinds:op.nodeKinds,writeScope:op.writes.map(w=>w.path),sideEffects:op.sideEffects,completionProfile:op.completionProfile,supportingReferences:supportingReferences(op),contract:op}))};
  const files=new Map([['catalog.json',JSON.stringify(catalogue,null,2)+'\n']]);
  for(const op of sorted) { files.set(op.id+'.md',document(op,'en')); files.set(op.id+'.vi.md',document(op,'vi')); }
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
