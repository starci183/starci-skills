/**
 * Self-contained owner UI: no remote assets, analytics, storage or secret-bearing URLs. One column, read top to
 * bottom: what the workflow needs from the owner first (decisions as choices, credentials as fields), then what it
 * is still preparing. The page is composed from the component set in inputs-components.mjs and owns only its
 * layout; its words follow the host's configured language while the records it shows stay as recorded.
 */
import {COMPONENT_SCRIPT,COMPONENT_STYLE} from './inputs-components.mjs';

const WORDS={
  vi:{
    eyebrow:'StarCi · Workflow',titleDecide:'Cần thầy quyết định',titleCredentials:'Kết nối để tiếp tục',titlePreparing:'Workflow đang chuẩn bị',titleRunning:'Workflow đang tiếp tục',titleFinished:'Workflow đã kết thúc',
    introDecide:'Chọn một phương án cho từng câu hỏi bên dưới. Nội dung bản ghi giữ nguyên tiếng Anh, đúng như cây lưu.',introCredentials:'Điền thông tin truy cập mà workflow đang cần. Khi lưu đủ, các tác vụ liên quan sẽ tự tiếp tục.',
    introPreparing:'Workflow đang kiểm tra tài liệu chính thức và chuẩn bị các bước kết nối. Các ô nhập sẽ xuất hiện khi đã rõ thông tin cần cung cấp.',introRunning:'Đã có đủ thông tin đang được yêu cầu. Workflow sẽ tiếp tục tự động.',introFinished:'Bạn có thể đóng trang này. Xem kết quả đầy đủ tại workflow trong Orca.',
    waiting:'Đang chờ thầy',preparing:'Đang chuẩn bị',running:'Đang tiếp tục',finished:'Đã kết thúc',unavailable:'Tạm không khả dụng',technical:'Chi tiết kỹ thuật',
    private:'Giá trị được ẩn và gửi thẳng vào kho mã hóa của workflow.',verify:'Lưu thành công xác nhận thông tin đã có trong kho. Workflow vẫn phải kiểm tra kết nối với dịch vụ.',
    guidance:'Lấy thông tin từ trang quản trị của dịch vụ tương ứng, rồi dán vào đúng ô bên dưới.',
    pending:'Chưa nhập',saved:'Đã lưu · chờ xác nhận',complete:'Đã xác nhận',tasks:'Tác vụ đang chờ',save:'Lưu thông tin',saving:'Đang lưu…',
    invalidCredential:'Dịch vụ đã từ chối thông tin hiện tại. Hãy nhập thông tin thay thế theo hướng dẫn; workflow sẽ kiểm tra lại.',expiredCredential:'Thông tin hiện tại đã hết hạn. Hãy cấp lại theo hướng dẫn rồi nhập giá trị mới; workflow sẽ kiểm tra lại.',
    empty:'Ô trống được giữ lại để nhập sau.',success:'Đã lưu. Workflow sẽ kiểm tra và tự tiếp tục khi đủ thông tin.',
    error:'Chưa lưu được. Kho mã hóa hoặc khóa giải mã chưa sẵn sàng; hãy thử lại khi kho sẵn sàng.',
    changed:'Yêu cầu đã thay đổi. Trang sẽ cập nhật.',invalid:'Yêu cầu không hợp lệ. Hãy tải lại trang trong Orca.',disconnected:'Đang kết nối lại với workflow…',
    session:'Phiên nhập không hợp lệ. Mở trang Thông tin truy cập của workflow trong Orca.',
    why:'Vì sao cần',where:'Lấy ở đâu',prepared:'Workflow đã chuẩn bị',ownerSteps:'Việc thầy cần làm',afterSubmit:'Sau khi trả lời',officialDocs:'Tài liệu chính thức',
    choose:'Chọn một phương án',recommended:'Khuyến nghị',original:'Bản ghi gốc (tiếng Anh)',preparingHint:'Workflow đang chuẩn bị các phương án cho câu hỏi này; chúng sẽ hiện tại đây.',other:'Phương án khác…',otherHint:'Chỉ dùng khi không phương án nào phù hợp.',answer:'Câu trả lời',confirm:'Tôi xác nhận',submitOwner:'Gửi câu trả lời',chooseFirst:'Hãy chọn một phương án trước.',queued:'Đã gửi. Workflow sẽ xử lý và tự tiếp tục.',
    statusWaiting:'Đang chờ thầy',statusPreparing:'Đang chuẩn bị phương án',statusAnswered:'Đã trả lời',statusCorrection:'Cần sửa',statusVerifying:'Đang kiểm tra',statusVerified:'Đã xác nhận',
    prepTitle:'Đang chuẩn bị kết nối',workflowStep:'Workflow',ownerStep:'Thầy',proofReady:'đã có bằng chứng',proofPending:'chưa có bằng chứng',docsChecked:'tài liệu chính thức đã kiểm tra',verificationPlanned:'bước xác minh đã lên kế hoạch',
    show:'Hiện',hide:'Ẩn',placeholder:'Dán giá trị tại đây',
    kinds:{'business-decision':'Quyết định kinh doanh',credential:'Thông tin truy cập',information:'Thông tin',account:'Tài khoản',access:'Quyền truy cập',consent:'Đồng ý',authority:'Ủy quyền','irreversible-confirmation':'Xác nhận không thể hoàn tác',question:'Câu hỏi'}
  },
  en:{
    eyebrow:'StarCi · Workflow',titleDecide:'Your decision is needed',titleCredentials:'Connect to continue',titlePreparing:'Workflow is preparing',titleRunning:'Workflow is continuing',titleFinished:'Workflow finished',
    introDecide:'Pick one option for each question below. The records keep their wording exactly as the tree spells it.',introCredentials:'Enter the credentials this workflow needs. Related tasks continue automatically once their required fields are saved.',
    introPreparing:'The workflow is checking official documentation and preparing the connection. Input fields appear once the information you need to provide is established.',introRunning:'All currently requested inputs are stored. The workflow will continue automatically.',introFinished:'You can close this page. See the complete result in the Orca workflow.',
    waiting:'Waiting for you',preparing:'Preparing',running:'Continuing',finished:'Finished',unavailable:'Temporarily unavailable',technical:'Technical details',
    private:'Values stay hidden and go directly to this workflow’s encrypted custody.',verify:'Saved confirms presence in custody. The workflow still has to verify the connection with the provider.',
    guidance:'Copy the credential from the service’s administration page and paste it into the matching field below.',
    pending:'Not entered',saved:'Saved · awaiting confirmation',complete:'Confirmed',tasks:'Waiting tasks',save:'Save credentials',saving:'Saving…',
    invalidCredential:'The service rejected the current credential. Enter its replacement using the guidance; the workflow will verify it again.',expiredCredential:'The current credential expired. Renew it using the guidance and enter the new value; the workflow will verify it again.',
    empty:'Empty fields remain waiting for later.',success:'Saved. The workflow checks presence and continues when its required fields are available.',
    error:'Unable to save. Encrypted storage or its decryption key is unavailable; retry when storage is ready.',
    changed:'The request changed. The page will refresh.',invalid:'Invalid request. Reload the page in Orca.',disconnected:'Reconnecting to the workflow…',
    session:'This input session is invalid. Open the workflow’s Credentials page in Orca.',
    why:'Why this is needed',where:'Where to get it',prepared:'Workflow prepared',ownerSteps:'What you need to do',afterSubmit:'After you answer',officialDocs:'Official documentation',
    choose:'Choose one option',recommended:'Recommended',original:'Original record',preparingHint:'The workflow is preparing the options for this question; they will appear here.',other:'Another answer…',otherHint:'Only when no option fits.',answer:'Your answer',confirm:'I confirm',submitOwner:'Submit answer',chooseFirst:'Choose an option first.',queued:'Submitted. The workflow will process it and continue.',
    statusWaiting:'Waiting for you',statusPreparing:'Preparing options',statusAnswered:'Answered',statusCorrection:'Needs correction',statusVerifying:'Verifying',statusVerified:'Verified',
    prepTitle:'Preparing connection',workflowStep:'Workflow',ownerStep:'Owner',proofReady:'evidence recorded',proofPending:'evidence pending',docsChecked:'official documents checked',verificationPlanned:'verification steps planned',
    show:'Show',hide:'Hide',placeholder:'Paste the value here',
    kinds:{'business-decision':'Business decision',credential:'Credential',information:'Information',account:'Account',access:'Access',consent:'Consent',authority:'Authority','irreversible-confirmation':'Irreversible confirmation',question:'Question'}
  }
};

/** Layout only: the page's column, header, context row and footer. Components bring their own styling. */
const PAGE_STYLE=`
main{max-width:720px;margin:0 auto;padding:40px 24px 64px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:hsl(var(--muted-foreground))}.mark{display:grid;place-items:center;width:22px;height:22px;border-radius:6px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));font-size:12px;font-weight:700;letter-spacing:0}
.context{margin:20px 0 28px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.context .t-mono{color:hsl(var(--muted-foreground));overflow-wrap:anywhere}
.question{white-space:pre-wrap;margin:0 0 12px}.tasks{font-size:12px;color:hsl(var(--muted-foreground));margin:8px 0 0;overflow-wrap:anywhere}
footer{margin-top:28px;display:flex;gap:10px;align-items:flex-start;color:hsl(var(--muted-foreground));font-size:12px;line-height:1.55}footer .lock{flex:none}
@media(max-width:600px){main{padding:24px 16px 48px}.t-title{font-size:24px}}
`;

export function inputPage({nonce,language='vi'}={}){
  const vi=String(language??'').toLowerCase().startsWith('vi'),words=vi?WORDS.vi:WORDS.en,tab=vi?'Thông tin & quyết định':'Inputs & decisions';
  return `<!doctype html><html lang="${vi?'vi':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${tab} · StarCi</title>
<style nonce="${nonce}">${COMPONENT_STYLE}${PAGE_STYLE}</style></head><body><main>
<div class="eyebrow"><span class="mark">S</span>${words.eyebrow}</div>
<header><h1 class="t-title" id="title">${words.titleCredentials}</h1><p class="t-lead" id="intro">${words.introCredentials}</p></header>
<div class="context"><span class="badge" id="phase"><span class="dot"></span><span id="phase-text">${words.waiting}</span></span><span class="t-mono" id="workflow"></span></div>
<div id="notice" class="note" role="status" aria-live="polite"></div>
<section id="owner"></section><section id="preparation"></section><div id="cards"></div>
<footer><span class="lock" aria-hidden="true">◇</span><span>${words.private}<br>${words.verify}</span></footer></main>
<script nonce="${nonce}">${COMPONENT_SCRIPT}
const words=${JSON.stringify(words)},tabTitle=${JSON.stringify(tab)},pageLanguage=${JSON.stringify(vi?'vi':'en')},token=location.hash.slice(1),cards=new Map(),ownerCards=new Map();let stopped=false,busy=false;
// The presentation the ask wrote in the page's language, when it wrote one; the record's own words otherwise.
const spokenOf=request=>request.presentation&&String(request.presentation.language||'').toLowerCase().startsWith(pageLanguage)?request.presentation:null;
const {el}=ui;
const ownerKey=request=>JSON.stringify([request.id,request.revision,request.optionsDigest??null,request.status]);
const optionShape=request=>JSON.stringify((request.options??[]).map(option=>[option.id,option.label]));
const message=code=>code==='empty'?words.empty:code==='request-changed'?words.changed:code==='invalid-request'?words.invalid:words.error;
const headers=()=>({'Authorization':'Bearer '+token,'Content-Type':'application/json'});
const kindLabel=kind=>words.kinds[kind]||kind;
const statusBadge=status=>status==='preparing'?['soft',words.statusPreparing]:status==='needs-correction'?['warn',words.statusCorrection]:status==='answered'||status==='saved'?['ok',words.statusAnswered]:status==='verifying'?['soft',words.statusVerifying]:status==='verified'?['ok',words.statusVerified]:['solid',words.statusWaiting];
function ownerGuide(request){
 const docs=(request.guidance?.docs||[]).map(source=>ui.link(source)).filter(Boolean);
 return ui.meta([[words.why,request.guidance?.why],[words.where,request.guidance?.where],[words.prepared,request.guidance?.prepared?.join(' · ')],[words.ownerSteps,request.guidance?.ownerSteps?.map(step=>step.action+(step.reason?' — '+step.reason:'')).join(' · ')],[words.afterSubmit,request.guidance?.afterSubmit],[words.officialDocs,docs.length?ui.joined(docs):null]]);
}
function renderOwner(requests){const root=document.querySelector('#owner'),seen=new Set();let position=0;for(const request of requests||[]){
 const key=ownerKey(request),shape=optionShape(request);seen.add(key);let entry=ownerCards.get(key);if(entry&&entry.optionShape!==shape){entry.card.remove();ownerCards.delete(key);entry=null;}
 if(entry){entry.heading.textContent=request.subject;entry.guide.replaceChildren();const guide=ownerGuide(request);if(guide)entry.guide.append(guide);if(root.children[position]!==entry.card)root.insertBefore(entry.card,root.children[position]??null);position++;continue;}
 const [tone,statusText]=statusBadge(request.status);
 const card=ui.card({tag:'form',kicker:[ui.badge(kindLabel(request.kind),'soft'),ui.badge(statusText,tone)],title:request.subject}),guide=el('div');
 const spoken=spokenOf(request),questionText=spoken?.text||request.guidance?.what;
 if(questionText&&questionText!==request.subject)card.body.append(el('p','question t-body',questionText));
 card.body.append(guide);const meta=ownerGuide(request);if(meta)guide.append(meta);
 const answerable=['waiting-owner','needs-correction'].includes(request.status),hasOptions=Boolean(request.options?.length),preparing=request.status==='preparing'&&!hasOptions;let choice=null,free=null,confirm=null,otherBox=null;
 const shown=hasOptions?request.options.map((option,index)=>({...option,label:spoken?.options?.[index]?.label||option.label})):[];
 if(preparing){card.body.append(ui.hint(words.preparingHint));}
 else if(hasOptions){
  choice=ui.radioGroup({name:'choice-'+request.id,legend:words.choose,options:shown,disabled:!answerable,recommendedText:words.recommended});card.body.append(choice.root);
  if(spoken){const original=el('details','tasks'),body=el('p','',[request.guidance?.what,...request.options.map((option,index)=>(index+1)+'. '+option.label)].filter(Boolean).join(' '));original.append(el('summary','',words.original),body);card.body.append(original);}
  const toggle=ui.button(words.other,{variant:'ghost'});otherBox=el('div','other');otherBox.hidden=true;free=ui.textarea({placeholder:words.answer});free.disabled=!answerable;otherBox.append(free,ui.hint(words.otherHint));
  toggle.addEventListener('click',()=>{otherBox.hidden=!otherBox.hidden;if(!otherBox.hidden)free.focus();});card.body.append(toggle,otherBox);
 }else if(['authority','consent','irreversible-confirmation'].includes(request.kind)){const box=ui.checkbox(words.confirm,{disabled:!answerable});confirm=box.input;card.body.append(box.root);}
 else{free=ui.textarea({placeholder:words.answer});free.disabled=!answerable;card.body.append(free);}
 const button=ui.button(words.submitOwner,{variant:'primary',type:'submit'}),feedback=ui.feedback();button.disabled=!answerable;
 if(!preparing)card.root.append(ui.foot(button));card.root.append(feedback);
 card.root.addEventListener('submit',async event=>{event.preventDefault();if(!answerable||preparing)return;
  let type,value;if(confirm){type='confirm';value=confirm.checked;}else if(hasOptions){const picked=choice.picked(),typed=free&&!otherBox.hidden?free.value.trim():'';if(picked){type='choose';value=picked.value;}else if(typed){type='answer';value=typed;}else{feedback.textContent=words.chooseFirst;feedback.className='feedback error';return;}}else{type='answer';value=free.value;}
  button.disabled=true;try{const response=await fetch('/owner-actions',{method:'POST',headers:headers(),body:JSON.stringify({requestId:request.id,revision:request.revision,optionsDigest:request.optionsDigest??null,type,value}),cache:'no-store'}),result=await response.json();feedback.textContent=result.ok?words.queued:message(result.code);feedback.className='feedback'+(result.ok?'':' error');if(result.ok&&free&&type==='answer')free.value='';}catch{feedback.textContent=words.disconnected;feedback.className='feedback error';}finally{button.disabled=!answerable;}});
 ownerCards.set(key,{card:card.root,heading:card.heading,guide,optionShape:shape});if(root.children[position]!==card.root)root.insertBefore(card.root,root.children[position]??null);position++;
 }for(const [key,entry] of ownerCards)if(!seen.has(key)){entry.card.remove();ownerCards.delete(key);}}
function renderPreparation(rows){const root=document.querySelector('#preparation');root.replaceChildren();for(const row of rows||[]){
 const card=ui.card({kicker:[ui.badge(words.preparing,'soft')],title:row.label||row.name,subtitle:[words.prepTitle,row.provider].filter(Boolean).join(' · ')});
 card.body.append(ui.guide(row.docs.length+' '+words.docsChecked+' · '+row.verificationSteps+' '+words.verificationPlanned));
 const links=row.docs.map(source=>ui.link(source,{strict:false})).filter(Boolean);if(links.length){const p=ui.guide('');p.append(ui.joined(links));card.body.append(p);}
 for(const step of row.prerequisites){const block=el('div','field'),owner=step.owner==='owner'?words.ownerStep:words.workflowStep;block.append(ui.small(owner+' · '+step.status+' · '+(step.proofPresent?words.proofReady:words.proofPending)),ui.guide([step.action,step.reason].filter(Boolean).join(' — ')));card.body.append(block);}
 card.body.append(el('p','tasks',words.tasks+': '+row.tasks.map(task=>task.label).join(', ')));root.append(card.root);}}
function makeCard(field){
 const card=ui.card({tag:'form',kicker:[ui.badge(kindLabel('credential'),'soft')],title:field.provider,subtitle:words.guidance});
 const button=ui.button(words.save,{variant:'primary',type:'submit'}),note=ui.small(words.empty),feedback=ui.feedback();card.root.append(ui.foot(note,button),feedback);document.querySelector('#cards').append(card.root);
 const group={card:card.root,fields:card.body,button,feedback,items:new Map()};
 card.root.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;const entries=[];
  for(const [id,item] of group.items){if(!item.input.disabled&&item.input.value)entries.push({id,value:item.input.value});item.input.value='';item.input.type='password';item.reveal.textContent=words.show;}
  if(!entries.length){feedback.textContent=words.empty;return;}busy=true;button.disabled=true;button.textContent=words.saving;feedback.textContent='';
  try{const response=await fetch('/credentials',{method:'POST',headers:headers(),body:JSON.stringify({entries}),cache:'no-store'});for(const entry of entries)entry.value='';const result=await response.json();feedback.className='feedback'+(result.ok?'':' error');feedback.textContent=result.ok?words.success:result.code?message(result.code):[...new Set((result.results||[]).filter(item=>!item.ok).map(item=>message(item.code)))].join(' ');}
  catch{feedback.className='feedback error';feedback.textContent=words.disconnected;}finally{for(const entry of entries)entry.value='';busy=false;button.textContent=words.save;await refresh();}
 });return group;
}
function headline(data){
 const decisions=(data.ownerRequests||[]).some(request=>['waiting-owner','needs-correction'].includes(request.status)),credentials=(data.fields||[]).some(field=>field.status==='pending');
 const mode=data.phase==='finished'?'Finished':decisions?'Decide':credentials?'Credentials':data.phase==='running'?'Running':'Preparing';
 document.querySelector('#title').textContent=words['title'+mode];document.querySelector('#intro').textContent=words['intro'+mode];
 const phase=document.querySelector('#phase');phase.className='badge '+(mode==='Decide'||mode==='Credentials'?'solid':mode==='Finished'?'ok':'soft');document.querySelector('#phase-text').textContent=words[data.phase]||words.waiting;
}
function render(data){
 document.querySelector('#workflow').textContent=data.workflow;headline(data);
 document.title=(data.phase==='waiting'?'● ':'')+tabTitle+' · '+data.workflow;
 const notice=document.querySelector('#notice');notice.textContent=data.unresolved?.length?words.introPreparing:data.phase==='unavailable'?words.disconnected:'';
 renderOwner(data.ownerRequests);renderPreparation(data.preparation);const seen=new Set();for(const field of data.fields){seen.add(field.id);let group=cards.get(field.slug);if(!group){group=makeCard(field);cards.set(field.slug,group);}let item=group.items.get(field.id);
  if(!item){const id='field-'+field.id,block=ui.field({label:field.label||field.name,forId:id}),secret=ui.secret({id,label:field.label||field.name,placeholder:words.placeholder,showText:words.show,hideText:words.hide}),tasks=el('p','tasks'),guidance=ui.guide([field.meaning,field.obtain].filter(Boolean).join(' ')),details=el('details','tasks');details.append(el('summary','',words.technical),el('p','',field.name+' · identity:'+field.slug));
   for(const source of field.sources||[]){const link=ui.link(source);if(link){guidance.append(el('br'),link);}}
   for(const step of field.ownerSteps||[])guidance.append(ui.guide(step.action+' '+step.reason));
   if(field.replacementReason)block.root.append(ui.warn(field.replacementReason==='expired'?words.expiredCredential:words.invalidCredential));
   block.root.append(secret.row,guidance,tasks,details);group.fields.append(block.root);item={wrapper:block.root,input:secret.input,reveal:secret.reveal,status:block.status,tasks};group.items.set(field.id,item);}
  item.status.textContent=words[field.status];item.status.dataset.status=field.status;item.input.disabled=field.status!=='pending'||data.phase==='finished';item.reveal.disabled=item.input.disabled;if(item.input.disabled)item.input.value='';item.tasks.textContent=words.tasks+': '+field.tasks.map(task=>task.label).join(', ');
 }
 for(const [slug,group] of cards){for(const [id,item] of group.items){if(!seen.has(id)){item.input.value='';item.wrapper.remove();group.items.delete(id);}}if(!group.items.size){group.card.remove();cards.delete(slug);}else group.button.disabled=busy||![...group.items.values()].some(item=>!item.input.disabled);}
 if(data.phase==='finished')stopped=true;
}
async function refresh(){if(!token){document.querySelector('#notice').textContent=words.session;stopped=true;return;}try{const response=await fetch('/status',{headers:headers(),cache:'no-store'});if(!response.ok)throw Error('unavailable');render(await response.json());}catch{document.querySelector('#notice').textContent=words.disconnected;}}
async function poll(){await refresh();if(!stopped)setTimeout(poll,2500);}poll();
window.addEventListener('pagehide',()=>{for(const input of document.querySelectorAll('input'))input.value='';});
</script></body></html>`;
}
