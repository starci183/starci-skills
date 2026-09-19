/** Canonical labels for a prepared policy decision, shared by SRS and owner-input validation. */
export function normalizePolicyOptions(values){
  if(!Array.isArray(values)||values.length<2||values.some(value=>typeof value!=='string'||!value.trim()))return null;
  const labels=values.map((value,index)=>value.trim().replace(new RegExp(`^${index+1}\\.\\s*`),'').trim());
  return labels.every(Boolean)&&new Set(labels).size===labels.length?labels:null;
}
