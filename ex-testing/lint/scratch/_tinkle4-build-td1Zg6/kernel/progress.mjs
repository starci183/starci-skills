import {loadConfig} from '../scripts/config.mjs';
const clip=(value,max=220)=>String(value??'').replace(/\s+/g,' ').replace(/(bearer\s+)[^\s]+/ig,'$1[redacted]')
  .replace(/\b([A-Za-z0-9_]*(?:TOKEN|PASSWORD|SECRET|CREDENTIAL|API_KEY|ACCESS_KEY)[A-Za-z0-9_]*)\b["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^,;]+)/ig,'$1=[redacted]').slice(0,max);

const WAIT_EVENTS=new Set(['manager-pending','manager-quota-wait','manager-unavailable','manager-refused','manager-no-progress',
  'admission-deferred','allocation-deferred','schedule-deferred','launch-cooling','launch-cap-reached','candidate-reconciliation-required',
  'launch-reconciliation-required','job-reconciliation-required','preflight-blocked','op-blocked','shared-change-blocked']);

/**
 * The words of the terminal lines, per language of the host's config.json. Only these words change: the event
 * kinds, operation ids, runtimes and the reasons quoted from the record stay as the record spells them (English),
 * so a line can always be matched back to its event.
 */
export const PROGRESS_MESSAGES={
  en:{manager:'manager',noAction:'no action',launched:'launched',on:'on',accepted:'accepted',reconciled:'native attempt reconciled',
    quarantined:'quarantined',drift:'canonical drift requires review',stopped:'stopped',finished:'finished',complete:'complete',waiting:'waiting',
    chose:'chose runtime',over:'over',sharedLoad:'shared load',remaining:'quota remaining',model:'model',forFunction:'for',mode:'mode',considered:'considered',
    opsLeft:'ops left',eta:'about',hour:'h',minute:'min'},
  vi:{manager:'điều phối',noAction:'không có hành động',launched:'đã khởi chạy',on:'trên',accepted:'đã chấp nhận',reconciled:'đã đối soát lượt native',
    quarantined:'đã cách ly',drift:'lệch so với bản chuẩn, cần rà soát',stopped:'đã dừng',finished:'hoàn tất',complete:'xong',waiting:'đang chờ',
    chose:'chọn runtime',over:'ưu tiên hơn',sharedLoad:'tải chung',remaining:'quota còn',model:'model',forFunction:'cho',mode:'chế độ',considered:'đã xét',
    opsLeft:'op còn lại',eta:'dự kiến ~',hour:'giờ',minute:'phút'}};
const duration=(ms,t)=>{const minutes=Math.max(1,Math.round(ms/60000)),hours=Math.floor(minutes/60);return hours?`${hours}${t.hour}${minutes%60?` ${minutes%60}${t.minute}`:''}`:`${minutes}${t.minute}`;};
/** Debug-only lines: how a runtime was allocated to an operation and which model a kernel function was given. */
const DEBUG_EVENTS=new Set(['allocation-shared','allocation-budgeted','model-selected']);
export const progressLanguage=language=>Object.hasOwn(PROGRESS_MESSAGES,String(language??'').toLowerCase().split('-')[0])?String(language).toLowerCase().split('-')[0]:'en';

/** A bounded terminal observer. It receives already-persisted audit events and never reads prompts or state. */
export function progressLine(event,{language='en',debug=false}={}){
  const t=PROGRESS_MESSAGES[progressLanguage(language)];
  const kind=event?.event,op=typeof event?.op==='string'?` ${event.op}`:'';
  if(DEBUG_EVENTS.has(kind)){
    if(!debug)return null;
    if(kind==='allocation-shared')return `[Kernel]${op}: ${t.chose} ${clip(event.runtime,60)}${Array.isArray(event.preferredOver)&&event.preferredOver.length?` (${t.over} ${event.preferredOver.join(', ')})`:''}${event.sharedLoad&&Object.keys(event.sharedLoad).length?` · ${t.sharedLoad} ${clip(JSON.stringify(event.sharedLoad),120)}`:''}`;
    if(kind==='allocation-budgeted')return `[Kernel]${op}: ${t.chose} ${clip(event.runtime,60)} · ${t.remaining} ${clip(JSON.stringify(event.remaining??{}),140)}`;
    return `[Kernel] ${t.model} ${clip(event.runtime,60)} ${t.forFunction} ${clip(event.function,40)}${op} · ${t.mode} ${clip(event.mode,20)}${Array.isArray(event.considered)&&event.considered.length?` · ${t.considered} ${clip(event.considered.map(item=>`${item.runtime}${Number.isFinite(item.remaining)?`:${item.remaining}`:''}`).join(', '),160)}`:''}`;
  }
  if(kind==='manager-applied')return `[Kernel] ${t.manager}: ${Array.isArray(event.actions)&&event.actions.length?event.actions.slice(0,8).join(', '):t.noAction}${event.rationale?` — ${clip(event.rationale)}`:''}`;
  if(kind==='launched'||kind==='op-relaunched')return `[Kernel]${op}: ${t.launched}${event.runtime?` ${t.on} ${clip(event.runtime,80)}`:''}`;
  if(kind==='op-done'||kind==='accepted-early'){
    if(!debug||kind!=='op-done')return `[Kernel]${op}: ${t.accepted}`;
    const outlook=Number.isFinite(event.remainingOps)?` · ${event.remainingOps} ${t.opsLeft}${Number.isFinite(event.estimateMs)&&event.remainingOps>0?` · ${t.eta} ${duration(event.estimateMs,t)}`:''}`:'';
    return `[Kernel]${op}: ${t.accepted}${event.summary?` — ${clip(event.summary,200)}`:''}${outlook}`;
  }
  if(kind==='native-attempt-reconciled'||kind==='failed-launch-stopped-proved')return `[Kernel]${op}: ${t.reconciled}`;
  if(kind==='candidate-quarantined'||kind==='record-blocks-quarantined')return `[Kernel]${op}: ${t.quarantined} — ${clip(event.reason??event.detail??t.drift)}`;
  if(kind==='stopped')return `[Kernel] ${t.stopped}`;
  if(kind==='finished')return `[Kernel] ${t.finished}: ${clip(event.outcome??event.reason??t.complete)}`;
  if(WAIT_EVENTS.has(kind))return `[Kernel] ${t.waiting}${op}: ${clip(event.reason??event.detail??event.code??kind)}`;
  return null;
}

/** The language of config.json, read once; a config that cannot be read speaks English. */
export function configuredProgressLanguage(load=()=>loadConfig()){
  try{return progressLanguage(load()?.language);}catch{return 'en';}
}
/** `debug: true` in config.json: the tab also shows how runtimes and models were chosen. Off by default. */
export function configuredProgressDebug(load=()=>loadConfig()){
  try{return load()?.debug===true;}catch{return false;}
}

export function createProgressReporter({enabled=process.env.STARCI_PROGRESS==='1'||process.stderr.isTTY,write=value=>process.stderr.write(value),language=null,debug=false}={}){
  const waits=new Set(),order=[];
  const spoken=language??'en';
  return event=>{
    if(!enabled)return false;
    const line=progressLine(event,{language:spoken,debug});if(!line)return false;
    // A wait is deduplicated by what it is, never by its words, so the rule holds in every language.
    const waiting=WAIT_EVENTS.has(event?.event);
    if(waiting&&waits.has(line))return false;
    if(waiting){waits.add(line);order.push(line);if(order.length>128)waits.delete(order.shift());}
    else{waits.clear();order.length=0;}
    write(`${line}\n`);return true;
  };
}
