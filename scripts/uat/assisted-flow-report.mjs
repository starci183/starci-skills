// The per-flow report of an assisted UAT receipt: every declared step takes the driver's event, or `not-run`.
const flowStatusOf=steps=>{
  if(steps.every(step=>step.status==='completed'))return 'completed';
  if(steps.some(step=>step.status==='failed'))return 'failed';
  if(steps.some(step=>step.status==='cancelled'))return 'cancelled';
  return 'inconclusive';
};

export const flowReports=(prepared,data)=>{
  const flowEvents=new Map(data.steps.map(step=>[`${step.flowId}\0${step.id}`,step]));
  return prepared.request.flows.map(flow=>{
    const steps=flow.steps.map(step=>flowEvents.get(`${flow.id}\0${step.id}`)??{id:step.id,status:'not-run',observed:null,evidenceRefs:[]});
    return {id:flow.id,status:flowStatusOf(steps),steps:steps.map(({id,status,observed,evidenceRefs})=>({id,status,observed,evidenceRefs}))};
  });
};
