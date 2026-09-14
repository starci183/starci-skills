/** Fictional provider evidence: tests exercise contracts, never claim a real provider was researched. */
export function preparedEntry(name='SERVICE_TOKEN',{slug='service',provider='Example service',pendingMachine=false}={}){
  const url='https://docs.example.test/auth',sourceRefs=[url];
  return {id:slug,provider,declaredBy:'example.demo.architecture',declaredPath:'features/demo/architecture/index.yaml',
    credential:{name,custody:`identity:${slug}`,providedBy:'owner'},
    preparation:{schema:'starci/integration-preparation@1',
      sources:[{url,title:'Synthetic provider authentication reference',publisher:provider,official:true,
        readAt:'2026-09-14T00:00:00Z',observation:'Synthetic fixture: token issued by owner; no inbound callbacks for this test use.'}],
      auth:{scheme:'API token',account:'Owner sandbox account',scopes:['read-test'],scopeReason:'Only the test read is authorized',sourceRefs,
        lifecycle:{issue:'Owner creates a token',expiry:'Follow provider expiration',refresh:'Not supported in this fixture',rotate:'Owner issues replacement',revoke:'Owner revokes token'}},
      credential:{name,custody:`identity:${slug}`,label:'Service access token',meaning:'Allows the workflow to check the sandbox connection.',
        obtain:'Open the service settings and create a read-only sandbox token.',sourceRefs},
      interfaces:{callback:{applicable:false,reason:'Outbound-only fixture',sourceRefs},webhook:{applicable:false,reason:'No inbound events in this fixture',sourceRefs}},
      prerequisites:[{id:'local-setup',owner:'workflow',action:'Prepare the local client',reason:'Needed to run the check',status:pendingMachine?'pending':'ready',
        ...(pendingMachine?{}:{evidence:'Synthetic test client inspected'}),sourceRefs}],
      verification:{steps:['Call the sandbox read endpoint','Check the provider response'],success:'The expected sandbox identity is returned',failure:'Reject absent or denied credentials',sourceRefs}}};
}

export function inputAsk(id,names=['SERVICE_TOKEN'],{requesters=['op-a'],slug='service',entries=names.map(name=>preparedEntry(name,{slug}))}={}){
  return {id,kind:'provision.ask',fill:true,status:'running',requesters,question:{stop:'credential',text:names.join(', ')},
    credential:{variables:names,custody:`identity:${slug}`,provider:'Example service',preparationRequired:true,ready:true,
      preparations:entries.map(entry=>({name:entry.credential.name,ok:true,preparation:entry.preparation}))}};
}
