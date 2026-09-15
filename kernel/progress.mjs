const clip=(value,max=220)=>String(value??'').replace(/\s+/g,' ').replace(/(bearer\s+)[^\s]+/ig,'$1[redacted]')
  .replace(/\b([A-Za-z0-9_]*(?:TOKEN|PASSWORD|SECRET|CREDENTIAL|API_KEY|ACCESS_KEY)[A-Za-z0-9_]*)\b["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^,;]+)/ig,'$1=[redacted]').slice(0,max);

const WAIT_EVENTS=new Set(['manager-pending','manager-quota-wait','manager-unavailable','manager-refused','manager-no-progress',
  'admission-deferred','allocation-deferred','schedule-deferred','launch-cooling','launch-cap-reached','candidate-reconciliation-required',
  'launch-reconciliation-required','job-reconciliation-required','preflight-blocked','op-blocked','shared-change-blocked']);

/** A bounded terminal observer. It receives already-persisted audit events and never reads prompts or state. */
export function progressLine(event){
  const kind=event?.event,op=typeof event?.op==='string'?` ${event.op}`:'';
  if(kind==='manager-applied')return `[Kernel] manager: ${Array.isArray(event.actions)&&event.actions.length?event.actions.slice(0,8).join(', '):'no action'}${event.rationale?` — ${clip(event.rationale)}`:''}`;
  if(kind==='launched'||kind==='op-relaunched')return `[Kernel]${op}: launched${event.runtime?` on ${clip(event.runtime,80)}`:''}`;
  if(kind==='op-done'||kind==='accepted-early')return `[Kernel]${op}: accepted`;
  if(kind==='native-attempt-reconciled'||kind==='failed-launch-stopped-proved')return `[Kernel]${op}: native attempt reconciled`;
  if(kind==='candidate-quarantined'||kind==='record-blocks-quarantined')return `[Kernel]${op}: quarantined — ${clip(event.reason??event.detail??'canonical drift requires review')}`;
  if(kind==='stopped')return '[Kernel] stopped';
  if(kind==='finished')return `[Kernel] finished: ${clip(event.outcome??event.reason??'complete')}`;
  if(WAIT_EVENTS.has(kind))return `[Kernel] waiting${op}: ${clip(event.reason??event.detail??event.code??kind)}`;
  return null;
}

export function createProgressReporter({enabled=process.env.STARCI_PROGRESS==='1'||process.stderr.isTTY,write=value=>process.stderr.write(value)}={}){
  const waits=new Set(),order=[];
  return event=>{
    if(!enabled)return false;
    const line=progressLine(event);if(!line)return false;
    const waiting=line.startsWith('[Kernel] waiting');
    if(waiting&&waits.has(line))return false;
    if(waiting){waits.add(line);order.push(line);if(order.length>128)waits.delete(order.shift());}
    else{waits.clear();order.length=0;}
    write(`${line}\n`);return true;
  };
}
