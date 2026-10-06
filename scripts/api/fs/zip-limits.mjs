import {zipRefuse as refuse} from './lib.mjs';

/** Supported local archive envelope; overrides may lower these caps, never raise them. */
const ZIP_RESOURCE_LIMITS=Object.freeze({maxArchiveBytes:256*1024**2,maxEntryBytes:64*1024**2,maxCompressedEntryBytes:64*1024**2,maxTotalBytes:256*1024**2,maxEntries:4096,maxNameBytes:1024});
/** Resolve supported ZIP limits; options may lower each cap, never raise it. */
export function zipLimits(options={}){
  const out={...ZIP_RESOURCE_LIMITS};
  for(const key of Object.keys(out)){
    if(options[key]!==undefined){const n=options[key];if(!Number.isInteger(n)||n<1||n>out[key]){throw refuse(`invalid ${key}: supported maximum is ${out[key]}`,'zip-limit');}out[key]=n;}
  }
  return out;
}
