import fs from 'node:fs';
import path from 'node:path';

/**
 * Disk headroom: what the kernel and the supervisor measure before they write. A volume with less free space
 * than the threshold is `exhausted`; the caller stops on the record instead of filling the disk and crashing
 * on the next SQLite write. The threshold is one number, read once per process, printed with every finding.
 */
export const DISK_HEADROOM='starci/disk-headroom@1';
export const DEFAULT_HEADROOM_BYTES=1024*1024*1024;
export const HEADROOM_ENV='STARCI_DISK_HEADROOM_BYTES';
export const headroomThreshold=(env=process.env)=>{const given=Number(env[HEADROOM_ENV]);return Number.isFinite(given)&&given>=0?Math.round(given):DEFAULT_HEADROOM_BYTES;};

/** The nearest existing ancestor of a path: the volume is the same, and a directory not yet created still has one. */
const existingAncestor=target=>{let current=path.resolve(target);for(;;){if(fs.existsSync(current))return current;const parent=path.dirname(current);if(parent===current)return current;current=parent;}};

/**
 * Free bytes on the volumes of the given paths. Each distinct volume (by its existing ancestor) is measured
 * once; an unmeasurable path is reported as `unknown` and counts as exhausted, because a kernel that cannot
 * tell how much room it has must not assume it has some.
 */
export function measureHeadroom(paths,{thresholdBytes=headroomThreshold(),statfs=fs.statfsSync}={}){
  const checks=[];const seen=new Set();
  for(const given of paths.filter(Boolean)){
    const at=existingAncestor(given);
    const key=process.platform==='win32'?at.toLowerCase():at;if(seen.has(key))continue;seen.add(key);
    try{const stat=statfs(at);const freeBytes=Number(stat.bsize)*Number(stat.bavail);checks.push({path:at,freeBytes,thresholdBytes,exhausted:!Number.isFinite(freeBytes)||freeBytes<thresholdBytes});}
    catch(error){checks.push({path:at,freeBytes:null,thresholdBytes,exhausted:true,reason:String(error?.message??error).slice(0,200)});}
  }
  const exhausted=checks.filter(check=>check.exhausted);
  return {schema:DISK_HEADROOM,ok:exhausted.length===0,thresholdBytes,checks,exhausted};
}

/** A write the disk refused: SQLite's full-disk error or the OS's. The kernel treats either as a headroom stop. */
export const isDiskFull=error=>{const text=String(error?.message??error??'');return error?.code==='ENOSPC'||error?.code==='SQLITE_FULL'||error?.errcode===13||/database or disk is full|SQLITE_FULL|ENOSPC/i.test(text);};

/** The typed stop the kernel raises: the supervisor sees the exit and measures for itself before starting anything. */
export const DISK_HEADROOM_CODE='STARCI_DISK_HEADROOM';
export function headroomError(measure){const error=Error(`disk headroom below ${measure.thresholdBytes} bytes: ${measure.exhausted.map(item=>`${item.path} has ${item.freeBytes??'unknown'}`).join('; ')}`);error.code=DISK_HEADROOM_CODE;error.measure=measure;return error;}
