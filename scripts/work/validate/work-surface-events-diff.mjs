// The event half of the surface diff of check-work-surfaces.mjs: the events the code declares and publishes against
// the work/event@1 records that name them.
import {eventSurface} from './work-surface-served.mjs';
import {eventClassNamesOf} from './work-surface-declared.mjs';

/** className -> the event record id it maps to: by its `kind` discriminant, else by the id-shaped class name. */
function recordOfClassIndex(eventRecs,allClasses){
  const recordOfClass=new Map();
  for(const [id] of eventRecs){
    for(const [className,value] of allClasses){
      if(value.kind===id||eventClassNamesOf(id).includes(className))recordOfClass.set(className,id);
    }
  }
  return recordOfClass;
}

export function eventIndexes(records,beRoots){
  const eventRecs=[...records].filter(([,record])=>record.schema==='work/event@1');
  const codeByRepo=beRoots.map(repo=>({repo,...eventSurface(repo)}));
  const allClasses=new Map();
  const allEmitted=new Map();
  const allEmittedIds=new Set();
  for(const {repo,classes,emitted,emittedIds} of codeByRepo){
    for(const [name,value] of classes)allClasses.set(name,{...value,repo});
    for(const [name,file] of emitted)allEmitted.set(name,{file,repo});
    for(const id of emittedIds)allEmittedIds.add(id);
  }
  const recordOfClass=recordOfClassIndex(eventRecs,allClasses);
  const emittedRecordIds=new Set([...allEmittedIds].filter(id=>records.has(id)));
  for(const [className] of allEmitted){
    if(recordOfClass.has(className))emittedRecordIds.add(recordOfClass.get(className));
  }
  return {eventRecs,codeByRepo,allClasses,allEmitted,recordOfClass,emittedRecordIds};
}

export function reportUnemittedEvents(eventRecs,emittedRecordIds,recordOfClass,indexFile,refuse,suspect,info){
  for(const [id,record] of eventRecs){
    if(emittedRecordIds.has(id))continue;
    const names=eventClassNamesOf(id).join('/');
    const blocked=Array.isArray(record.data?.blockedBy)&&record.data.blockedBy.length;
    const msg=`${id} maps to event class ${names}, but nothing under src/ publishes it `+
      '- the record describes an event nothing emits';
    if(record.data?.state==='done')refuse(indexFile(record),'EVENT_UNEMITTED',msg);
    else if(blocked){
      const gaps=record.data.blockedBy.map(item=>item?.record).filter(Boolean).join(', ');
      info(indexFile(record),'EVENT_UNEMITTED',`${msg}; the record itself says so (todo, blockedBy ${gaps})`);
    }else suspect(indexFile(record),'EVENT_UNEMITTED',`${msg} (record is ${record.data?.state??'(no state)'})`);
  }
}

export function reportUnrecordedEvents(allEmitted,allClasses,recordOfClass,suspect){
  for(const [className,site] of allEmitted){
    if(recordOfClass.has(className))continue;
    suspect(site.file,'EVENT_UNDECLARED',
      `${className} is constructed under src/ but no work/event@1 record maps to it `+
      '- an emitted signal the tree does not name');
  }
  for(const [className,value] of allClasses){
    if(allEmitted.has(className)||recordOfClass.has(className))continue;
    suspect(value.file,'EVENT_CLASS_ORPHAN',
      `${className} is declared under src/ but is neither published nor claimed by a work/event@1 record - dead vocabulary`);
  }
}

export function reportContractEvents(declaredContractEvents,records,canon,suspect){
  for(const event of declaredContractEvents){
    if(!records.has(canon(event.id))){
      suspect(event.file,'CONTRACT_EVENT_GHOST',`${event.by}'s surface names ${event.id}, which no work/event@1 record owns`);
    }
  }
}
