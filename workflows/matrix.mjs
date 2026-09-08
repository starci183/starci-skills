import { selectOperation } from '../ops/select.mjs';

const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'&&x.trim().length>0;
const unique=x=>new Set(x).size===x.length;
const fields=(x,required,optional=[])=>plain(x)&&required.every(k=>Object.hasOwn(x,k))&&Object.keys(x).every(k=>[...required,...optional].includes(k));

/** Validate scheduling and handoff declarations only; never execute or certify a job. */
export function validateJobMatrices(bundle, catalogue) {
  const errors=[];
  const fail=(at,reason)=>errors.push({at,reason});
  if(!fields(bundle,['schema','limits','purpose','bindingRules','workflows'])||bundle.schema!=='starci/job-matrices@1'||JSON.stringify(bundle.limits)!==JSON.stringify({rows:3,columns:3,secondaryDefinitions:3})||!Array.isArray(bundle.workflows)||!bundle.workflows.length) return {ok:false,errors:[{at:'bundle',reason:'Invalid matrix bundle or limits'}]};
  const operators=new Map(catalogue.ops.map(op=>[op.id,op.contract]));
  const ids=new Set();
  for(const workflow of bundle.workflows) {
    if(!fields(workflow,['id','parameters','matrix','transition'],['operations'])||!text(workflow.id)||ids.has(workflow.id)){fail('workflow','Invalid or duplicate workflow');continue;}
    ids.add(workflow.id);
    if(!Array.isArray(workflow.parameters)||!workflow.parameters.every(text)||!unique(workflow.parameters))fail(workflow.id,'Invalid parameters');
    if(!Array.isArray(workflow.matrix)||workflow.matrix.length<1||workflow.matrix.length>3){fail(workflow.id,'At most three sequential rows');continue;}
    if(workflow.operations&&(!Array.isArray(workflow.operations)||!workflow.operations.length||!workflow.operations.every(text)||!unique(workflow.operations)))fail(workflow.id,'Invalid operation variants');
    const expectedTransition={request:'exact-cell-op-mode-inputs-criteria',response:'matching-request-digest-and-op-mode',advance:'all-required-criteria-pass-and-output-evidence-verified',missingOrFailed:'remain-in-cell',repair:'same-cell-same-acceptance-bounded-retry',evidence:'actual-artifacts-and-selected-work-completion-profile',dispatch:'explicit-coordinator-only'};
    if(!fields(workflow.transition,Object.keys(expectedTransition))||Object.entries(expectedTransition).some(([k,v])=>workflow.transition[k]!==v))fail(workflow.id,'Strict transition policy is required');
    const cells=new Map();
    for(const [rowIndex,row]of workflow.matrix.entries()) {
      if(!Array.isArray(row)||row.length<1||row.length>3){fail(workflow.id,'At most three parallel jobs per row');continue;}
      const writes=[];
      for(const cell of row) {
        if(!fields(cell,['id','op','inputs','outputs','criteria','writeScopes'],['operation'])||!text(cell.id)||cells.has(cell.id)){fail(workflow.id,'Invalid or duplicate cell');continue;}
        cells.set(cell.id,{...cell,row:rowIndex});
        try{if(workflow.operations)for(const operation of workflow.operations)selectOperation(operators.get(cell.op),operation);else selectOperation(operators.get(cell.op),cell.operation);}catch{fail(cell.id,'Unknown operator or invalid operation selection');}
        for(const key of ['outputs','criteria','writeScopes']) if(!Array.isArray(cell[key])||!cell[key].length||!cell[key].every(text)||!unique(cell[key]))fail(cell.id,'Invalid '+key);
        if(Array.isArray(cell.writeScopes))for(const scope of cell.writeScopes){if(!text(scope))continue;if(writes.some(s=>s===scope||s.startsWith(scope+'/')||scope.startsWith(s+'/')))fail(cell.id,'Parallel jobs overlap mutable ownership');writes.push(scope);}
      }
    }
    for(const cell of cells.values()) {
      if(!plain(cell.inputs)||!Object.keys(cell.inputs).length){fail(cell.id,'Inputs required');continue;}
      for(const binding of Object.values(cell.inputs)) {
        if(fields(binding,['parameter'])){if(!workflow.parameters?.includes(binding.parameter))fail(cell.id,'Unknown input parameter');}
        else if(fields(binding,['cell','output'])){
          const producer=cells.get(binding.cell);
          if(!producer||producer.row>=cell.row||!producer.outputs?.includes(binding.output))fail(cell.id,'Input must reference a declared output in a previous row');
        }else fail(cell.id,'Unknown input binding shape');
      }
    }
  }
  return {ok:errors.length===0,errors};
}
