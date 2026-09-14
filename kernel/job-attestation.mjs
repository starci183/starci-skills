export function attestModelResult(result,{functionName,jobId,generation,executorPid,input}={}){
  if(functionName!=='validateOp'||!result||typeof result!=='object')return result;
  const complete=input?.diff?.truncated!==true&&input?.resolvedReferencesTruncated!==true&&input?.materialTruncated!==true;
  return {...result,complete,independentFromAttempt:true,freshContext:true,reviewerAttemptId:`${jobId}:${generation}:pid-${executorPid}`,
    reviewerProcess:{pid:executorPid,detached:true,context:'durable-model-executor'}};
}
