import path from 'node:path';

export function declaredSubscriptions(records,featureOf,canon){
  const byFeature=new Map();
  for(const [,record] of records){
    for(const eventId of Array.isArray(record.data?.subscribes)?record.data.subscribes:[]){
      const feature=featureOf(record);
      if(!byFeature.has(feature))byFeature.set(feature,new Set());
      byFeature.get(feature).add(canon(eventId));
    }
  }
  return byFeature;
}

export function wiredSubscriptions(codeByRepo,ownerOf,recordOfClass,suspect){
  const byFeature=new Map();
  for(const {subscriptions} of codeByRepo){
    for(const sub of subscriptions){
      const owner=ownerOf(sub.file);
      const feature=owner?.feature??null;
      for(const className of sub.classes.filter(name=>!recordOfClass.has(name))){
        suspect(sub.file,'SUBSCRIPTION_UNDECLARED',
          `${path.basename(sub.file)} handles ${className}, which maps to no work/event@1 record`);
      }
      if(!feature)continue;
      if(!byFeature.has(feature))byFeature.set(feature,{files:[],ids:new Set()});
      const entry=byFeature.get(feature);
      entry.files.push(sub.file);
      for(const className of sub.classes)if(recordOfClass.has(className))entry.ids.add(recordOfClass.get(className));
    }
  }
  return byFeature;
}

export function reportWiredSubscriptionDiff(wiredByFeature,subscribesByFeature,records,canon,suspect){
  for(const [feature,wired] of wiredByFeature){
    const declared=subscribesByFeature.get(feature)??new Set();
    const subs=wired.files.map(file=>path.basename(file)).join(', ');
    for(const eventId of wired.ids){
      if(!declared.has(eventId)){
        suspect(wired.files[0],'SUBSCRIPTION_UNDECLARED',
          `${feature}'s subscribers (${subs}) handle ${eventId}, but no ${feature} record's subscribes names it`);
      }
    }
    for(const eventId of declared){
      if(wired.ids.has(eventId)||!records.has(canon(eventId)))continue;
      suspect(wired.files[0],'SUBSCRIPTION_NOT_WIRED',
        `${feature}'s records subscribe to ${eventId}, but its subscribers (${subs}) never handle it `+
        '- a declared subscription with no code behind it');
    }
  }
}

export function reportFeaturesWithoutSubscribers(records,wiredByFeature,featureOf,canon,indexFile,suspect){
  for(const [id,record] of records){
    const feature=featureOf(record);
    if(wiredByFeature.has(feature))continue;
    for(const eventId of Array.isArray(record.data?.subscribes)?record.data.subscribes:[]){
      if(!records.has(canon(eventId)))continue;
      suspect(indexFile(record),'SUBSCRIPTION_NOT_WIRED',
        `${id} subscribes to ${eventId}, but feature ${feature} has no subscriber under any bound `+
        "repository's src/ - a declared subscription with no code behind it");
    }
  }
}

export function appendSurfaceMap(out,repoRoots,servedRoutes,ops,feRoutesAll,claimedRouteKeys,claimedFe,codeByRepo,eventRecs,emittedRecordIds,subscribesByFeature,records,declaredHttp,integrationEndpoints,declaredGql,claims,ownerOf,servedKey){
  for(const repo of repoRoots){
    const repoName=path.basename(repo);
    const routes=servedRoutes.filter(route=>route.repo===repo);
    const repoOps=ops.filter(op=>op.repo===repo);
    const fe=feRoutesAll.filter(route=>route.repo===repo);
    const ev=codeByRepo.find(item=>item.repo===repo);
    const declared=routes.filter(route=>claimedRouteKeys.has(servedKey(route))).length;
    const ownedOnly=routes.filter(route=>!claimedRouteKeys.has(servedKey(route))&&ownerOf(route.file)).length;
    const lines=[`${repoName}: ${routes.length} http route(s) (${declared} declared, ${ownedOnly} owned-only)`];
    if(repoOps.length)lines.push(`${repoOps.length} graphql op(s), ${repoOps.filter(op=>op.claim).length} claimed`);
    if(fe.length){
      const uiClaimed=fe.filter(route=>claimedFe.has(`${route.repo}#${route.app??''}#${route.norm}`)).length;
      lines.push(`${fe.length} fe route(s), ${uiClaimed} ui-claimed`);
    }
    if(ev&&(ev.classes.size||ev.emitted.size)){
      lines.push(`${ev.classes.size} event class(es), ${ev.emitted.size} emitted, `+
        `${ev.subscriptions.length} subscriber file(s)`);
    }
    out.map.push(lines.join('; '));
  }
  const doneRecs=eventRecs.filter(([,record])=>record.data?.state==='done').length;
  if(eventRecs.length){
    out.map.push(`${eventRecs.length} work/event@1 record(s) (${doneRecs} done), ${emittedRecordIds.size} `+
      `emitted, ${subscribesByFeature.size} feature(s) declaring subscribes`);
  }
  out.map.push(`${records.size} record(s) total; ${declaredHttp.length} contract http declaration(s), `+
    `${integrationEndpoints.length} integration endpoint(s), ${declaredGql.length} contract graphql `+
    `declaration(s), ${claims.length} ui route claim(s)`);
}
