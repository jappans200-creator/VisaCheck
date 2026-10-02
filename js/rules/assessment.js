(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VisaCheckAssessment=api;})(globalThis,function(){
  'use strict';
  const VERSION='1.1.0';
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const text=v=>typeof v==='string'&&v.trim().length>0;
  const key=r=>[r.asset_key,r.result_kind,r.result_id,r.revision].join('@');
  const fail=code=>{throw new Error('Assessment configuration: '+code);};
  function validateConfiguration(c,catalog=null,release=null){
    if(!object(c)||!['1.0.0','1.1.0'].includes(c.schema_version)||!text(c.configuration_id)||!text(c.revision)||!object(c.release)||!text(c.release.release_id)||!text(c.release.version)||!Array.isArray(c.results)||!c.results.length||!Array.isArray(c.limitations)||!c.limitations.every(text))fail('INVALID_CONFIGURATION');
    if(c.publication?.status!=='DEVELOPMENT_PREVIEW'||c.publication.release_ready!==false)fail('INVALID_PUBLICATION');
    if(release&&(c.release.release_id!==release.release_id||c.release.version!==release.version))fail('RELEASE_MISMATCH');
    const p=c.policy;
    if(!object(p)||!Number.isInteger(p.minimum_community_sample)||p.minimum_community_sample<1||!Number.isFinite(p.strong_above)||!Number.isFinite(p.mid_from)||p.mid_from<0||p.strong_above<p.mid_from||p.strong_above>100||typeof p.readiness_attention!=='boolean'||typeof p.require_complete_for_profile_band!=='boolean')fail('INVALID_POLICY');
    const seen=new Set();
    for(const r of c.results){
      if(!object(r)||!['official','readiness','procedure'].includes(r.result_kind)||!['BLOCKING','READINESS','PROCEDURAL','INFORMATIONAL','SPECIAL_REVIEW','VERIFICATION','TIMING'].includes(r.role)||![r.asset_key,r.result_id,r.revision,r.label,r.action].every(text)||typeof r.material!=='boolean'||r.expected_presence!=='WHEN_ASSET_SELECTED')fail('INVALID_RESULT_BINDING');
      if(['VERIFICATION','TIMING'].includes(r.role)){
        if(c.schema_version!=='1.1.0'||r.result_kind!=='official'||r.material!==false||!['REQUIREMENT_NOT_MET','ATTENTION'].includes(r.on_fail))fail('INVALID_STATUS_POLICY');
      }else if(r.on_fail!==undefined)fail('INVALID_STATUS_POLICY');
      const identity=[r.result_kind,r.result_id].join('@');
      if(seen.has(identity))fail('DUPLICATE_OR_CONFLICTING_ROLES');seen.add(identity);
      if(r.role==='BLOCKING'&&r.result_kind!=='official')fail('INVALID_BLOCKING_KIND');
      if(r.role==='READINESS'&&r.result_kind!=='readiness')fail('INVALID_READINESS_KIND');
      if(catalog&&!catalog.some(a=>key(a)===key(r)))fail('UNKNOWN_RESULT_REFERENCE:'+r.result_id);
    }
    if(!c.results.some(r=>r.role==='BLOCKING'&&r.material))fail('NO_MATERIAL_BLOCKING_CHECKS');
    return c;
  }
  const ref=(binding,result)=>({asset_key:binding.asset_key,result_kind:binding.result_kind,result_id:binding.result_id,revision:binding.revision,role:binding.role,status:result?.status??'UNKNOWN',label:binding.label});
  function assess({official_results=[],readiness_results=[],procedure_results=[],community_result=null,coverage={},assessment_configuration=null}={}){
    const c=assessment_configuration,diagnostics=[];
    if(c)validateConfiguration(c,null,coverage.release_id?{release_id:coverage.release_id,version:coverage.version}:null);
    const stats=community_result?.statistics;
    const score=typeof stats?.percent==='number'&&Number.isFinite(stats.percent)&&stats.percent>=0&&stats.percent<=100?stats.percent:null;
    const sample=Number.isSafeInteger(stats?.sampleSize)&&stats.sampleSize>=0?stats.sampleSize:null;
    const available=score!==null&&sample!==null&&sample>=(c?.policy.minimum_community_sample??3);
    const result={assessment_version:VERSION,configuration_id:c?.configuration_id??null,configuration_version:c?.revision??null,primary_status:'CHECK_REQUIRED',official:{status:'CHECK_REQUIRED',blockers:[],warnings:[],unknowns:[],contributing_results:[]},profile:{score:null,score_source:'COMMUNITY_MODEL',band:null},community:{score,sample_size:sample,available,provenance:community_result?.provenance??null,model_metadata:community_result?.model_metadata??null,limitations:[...(c?.limitations??[]),...(Array.isArray(community_result?.limitations)?community_result.limitations:[])]},readiness:{ready:0,needs_attention:0,unknown:0,not_applicable:0,contributing_results:[]},procedure:{ready:0,needs_attention:0,unknown:0,not_applicable:0,contributing_results:[]},verification:{status:'NOT_ASSESSED',ready:0,needs_attention:0,unknown:0,not_applicable:0,contributing_results:[]},timing:{status:'NOT_ASSESSED',ready:0,needs_attention:0,unknown:0,not_applicable:0,contributing_results:[]},escalations:[],completeness:'INCOMPLETE',actions:[],explanation:{summary:'More information or review is required.',contributors:[],community_note:'Historical/community comparison does not override official requirements.'},diagnostics,provenance:{release_id:coverage.release_id??null,release_version:coverage.version??null,publication:coverage.publication??null,configuration_publication:c?.publication??null}};
    if(coverage.status==='UNSUPPORTED'){
      result.primary_status=result.official.status='UNSUPPORTED';result.completeness='LIMITED';
      result.explanation.summary='This route is outside configured assessment coverage.';return result;
    }
    if(!c){diagnostics.push({code:'MISSING_ASSESSMENT_CONFIGURATION'});return result;}
    if(!Array.isArray(coverage.selected_asset_keys)){diagnostics.push({code:'MISSING_ASSET_CONTEXT'});return result;}
    const configured=new Map(c.results.map(r=>[key(r),r])), observed=new Map();
    for(const [kind,items]of [['official',official_results],['readiness',readiness_results],['procedure',procedure_results]]){
      if(!Array.isArray(items))fail('INVALID_RESULT_COLLECTION');
      for(const item of items){
        if(!object(item))fail('INVALID_RESULT');
        const k=key({...item,result_kind:kind});
        if(!configured.has(k)){diagnostics.push({code:'UNCONFIGURED_RESULT',result_id:item.result_id});continue;}
        if(observed.has(k)){diagnostics.push({code:'DUPLICATE_RESULT',result_id:item.result_id});observed.set(k,null);}else observed.set(k,item);
      }
    }
    const count=(summary,r)=>{
      const bucket=['PASS','PRESENT','READY'].includes(r.status)?'ready':['FAIL','MISSING','ACTION_REQUIRED','WARNING'].includes(r.status)?'needs_attention':r.status==='NOT_APPLICABLE'?'not_applicable':'unknown';
      summary[bucket]++;summary.contributing_results.push(r);return bucket;
    };
    let expectedBlocking=0;
    for(const binding of c.results){
      if(!coverage.selected_asset_keys.includes(binding.asset_key))continue;
      const item=observed.get(key(binding)),r=ref(binding,item);
      if(!item)diagnostics.push({code:'MISSING_EXPECTED_RESULT',result_id:binding.result_id,revision:binding.revision,material:binding.material});
      if(binding.role==='BLOCKING'){
        if(binding.material)expectedBlocking++;
        const applicable=item?.applicability?.outcome;
        const resolvedNA=item?.status==='NOT_APPLICABLE'&&applicable==='NO_MATCH';
        result.official.contributing_results.push(r);
        if(item?.status==='FAIL'&&applicable==='MATCH')result.official.blockers.push(r);
        else if(binding.material&&(!item||!resolvedNA&&(applicable!=='MATCH'||!['PASS','WARNING','FAIL'].includes(item.status))))result.official.unknowns.push(r);
        else if(item?.status==='WARNING'&&applicable==='MATCH')result.official.warnings.push(r);
      }else if(['VERIFICATION','TIMING'].includes(binding.role)){
        const summary=binding.role==='VERIFICATION'?result.verification:result.timing;
        // Unresolved applicability cannot establish a pass or a failure.
        const resolved=item?.applicability?.outcome==='MATCH'||item?.status==='NOT_APPLICABLE'&&item?.applicability?.outcome==='NO_MATCH';
        const display=resolved?r:{...r,status:'UNKNOWN'};
        count(summary,display);
        if(display.status==='FAIL')result.escalations.push({result_ref:r,primary_status:binding.on_fail});
      }else if(binding.role==='READINESS')count(result.readiness,r);
      else if(binding.role==='PROCEDURAL')count(result.procedure,r);
      else if(binding.role==='SPECIAL_REVIEW'&&!['PASS','NOT_APPLICABLE'].includes(r.status))result.official.warnings.push(r);
      if(['FAIL','MISSING','UNKNOWN','WARNING','ACTION_REQUIRED'].includes(r.status)&&binding.role!=='INFORMATIONAL')result.actions.push({result_ref:r,text:binding.action,category:binding.role});
    }
    for(const [name,summary]of [['verification',result.verification],['timing',result.timing]])summary.status=summary.needs_attention?'ACTION_REQUIRED':summary.unknown?(name==='verification'?'NEEDS_VERIFICATION':'NOT_ASSESSED'):summary.ready?'PASS':summary.not_applicable?'NOT_APPLICABLE':'NOT_ASSESSED';
    const configurationGap=diagnostics.some(d=>['UNCONFIGURED_RESULT','DUPLICATE_RESULT'].includes(d.code));
    const incomplete=result.official.unknowns.length>0||!expectedBlocking||configurationGap||coverage.status!=='SUPPORTED';
    result.official.status=result.official.blockers.length?'REQUIREMENT_NOT_MET':incomplete?'CHECK_REQUIRED':result.official.warnings.length?'ATTENTION':'CLEAR_FOR_CONFIGURED_CHECKS';
    result.completeness=incomplete?'INCOMPLETE':result.readiness.unknown>0||!available?'LIMITED':'COMPLETE_FOR_CONFIGURED_SCOPE';
    result.profile.score=available?score:null;
    if(result.official.status!=='CLEAR_FOR_CONFIGURED_CHECKS')result.primary_status=result.official.status;
    else if(result.escalations.length)result.primary_status=result.escalations.some(e=>e.primary_status==='REQUIREMENT_NOT_MET')?'REQUIREMENT_NOT_MET':'ATTENTION';
    else if(c.policy.readiness_attention&&result.readiness.needs_attention>0)result.primary_status='ATTENTION';
    else if(c.policy.require_complete_for_profile_band&&result.completeness!=='COMPLETE_FOR_CONFIGURED_SCOPE')result.primary_status=available?'CHECK_REQUIRED':'CLEAR_FOR_CONFIGURED_CHECKS';
    else if(available){result.profile.band=score>c.policy.strong_above?'STRONG_PROFILE':score>=c.policy.mid_from?'NEEDS_ATTENTION':'PROFILE_NEEDS_WORK';result.primary_status=result.profile.band;}
    else result.primary_status='CLEAR_FOR_CONFIGURED_CHECKS';
    const summaries={REQUIREMENT_NOT_MET:'An official requirement checked by VisaCheck is not currently met.',CHECK_REQUIRED:'More information or review is required before the configured checks can be resolved.',ATTENTION:'The configured assessment identified items needing attention.',CLEAR_FOR_CONFIGURED_CHECKS:'No configured blocking issue was identified within the supported scope.',STRONG_PROFILE:'Configured blocking checks are clear; the historical/community comparison is in the strong profile band.',NEEDS_ATTENTION:'Configured blocking checks are clear; the historical/community comparison is in the middle profile band.',PROFILE_NEEDS_WORK:'Configured blocking checks are clear; the historical/community comparison is in the lower profile band.'};
    result.explanation.summary=summaries[result.primary_status];
    result.explanation.contributors=[...result.official.blockers,...result.official.unknowns,...result.official.warnings];
    result.explanation.community_note=available?`Your historical/community comparison is ${score}/100 from ${sample} records; it does not override official requirements.`:'No usable historical/community score is available. Unknown is not zero.';
    return result;
  }
  return {VERSION,validateConfiguration,assess};
});
