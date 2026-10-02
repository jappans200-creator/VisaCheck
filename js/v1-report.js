(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./rules/assessment-adapter.js'):root.VisaCheckAssessmentAdapter);if(typeof module==='object'&&module.exports)module.exports=api;else root.VisaCheckV1Report=api;})(globalThis,function(assessmentAPI){
'use strict';
const labels={
SCHENGEN_TRAVEL_DOCUMENT_REMAINING_VALIDITY:'Passport validity after departure',SCHENGEN_TRAVEL_DOCUMENT_MAX_AGE:'Passport age at lodging',SCHENGEN_TRAVEL_DOCUMENT_BLANK_PAGES:'Blank passport pages',SCHENGEN_SHORT_STAY_90_IN_180:'Schengen rolling stay limit',FRANCE_IE_APPLICATION_JURISDICTION:'Application jurisdiction and legal residence',FRANCE_IE_IRP_DOCUMENT_PRESENCE:'Irish residence card',FRANCE_IE_IRP_POST_RETURN_VALIDITY:'IRP validity after return',SCHENGEN_INSURANCE_PRESENCE:'Travel medical insurance',SCHENGEN_INSURANCE_COVERAGE_AMOUNT:'Insurance coverage amount',SCHENGEN_INSURANCE_DATE_COVERAGE:'Insurance dates',SCHENGEN_INSURANCE_TERRITORY:'Insurance territory',SCHENGEN_INSURANCE_MEDICAL_REPATRIATION:'Medical repatriation cover',SCHENGEN_INSURANCE_EMERGENCY_OR_HOSPITAL_COVERAGE:'Emergency medical or hospital cover',SCHENGEN_EARLIEST_LODGING:'Earliest application date',SCHENGEN_INSURANCE_EVIDENCE:'Insurance evidence',SCHENGEN_ACCOMMODATION_EVIDENCE:'Accommodation evidence',SCHENGEN_FINANCIAL_EVIDENCE:'Financial evidence',SCHENGEN_RETURN_FUNDS_EVIDENCE:'Return travel funds',SCHENGEN_RETURN_ONWARD_EVIDENCE:'Return or onward travel evidence',SCHENGEN_ITINERARY_EVIDENCE:'Travel itinerary',SCHENGEN_PURPOSE_EVIDENCE:'Purpose evidence',SCHENGEN_INTENTION_INFORMATION:'Intention-to-leave information',FRANCE_PRIVATE_HOST_ORIGINAL_ATTESTATION:'Original private-host attestation',APPLICATION_FORM:'Application form',APPLICATION_RECEIPT:'Application receipt',PASSPORT_ORIGINAL:'Passport original',PASSPORT_COPY:'Passport copy',IDENTITY_PHOTOS:'Identity photos',SUPPORTING_DOCUMENT_SET:'Supporting originals and copies',ONLINE_FORM:'France-Visas form',ONLINE_VALIDATION:'Online validation',APPOINTMENT:'Appointment',FILE_ASSERTION:'Personal checklist review',SUBMISSION:'Submission',PASSPORT_RETURN:'Passport return envelope',SCHENGEN_BIOMETRICS_PROCEDURE:'Biometrics',IRELAND_RETURN_DOCUMENT_READINESS:'Return to Ireland',FRANCE_SHORT_STAY_PURPOSES:'Purpose route'};
const reasons={NEW_COLLECTION_REQUIRED:'A new biometric collection is needed; follow the appointment instructions.',POTENTIAL_REUSE_REQUIRES_CONFIRMATION:'Previous collection is within the configured reuse window, but reuse still needs confirmation.',REUSE_REPORTED_CONFIRMED:'You reported confirmed reuse. This does not establish an attendance exemption.',SPECIAL_BIOMETRIC_HANDLING_REQUIRED:'Special biometric handling requires contact with the application service.',AGE_BOUNDARY_REQUIRES_REVIEW:'The age boundary remains under review.',VALID_CARD_ON_RETURN:'The supplied card is valid on the return date under this diagnostic.',VALID_RETURN_DOCUMENT_REQUIRED:'Return documentation needs action. A pending renewal is not treated as a valid card.',RETURN_DOCUMENT_REQUIRES_REVIEW:'Return documentation needs review.',SPECIAL_OR_DIFFERENT_ROUTE_REQUIRED:'The supplied facts need a different or special route.',UNRESOLVED_ROUTE_DURATION:'Trip dates are needed to determine purpose-route scope.'};
const label=r=>labels[r.rule_id||r.evidence_id||r.procedure_id||r.configuration_id||r.diagnostic_id]||'Requirement check';
// Experimental display bands only. The historical percentage is supplied by
// the unchanged community calculation; official results never enter this map.
function scoreStamp(percent){
 if(typeof percent!=='number'||!Number.isFinite(percent)||percent<0||percent>100)return null;
 return {value:percent,tone:percent>75?'green':percent>=50?'amber':'red',label:percent>75?'STRONG PROFILE':percent>=50?'NEEDS ATTENTION':'ACTION NEEDED'};
}
function communityScoreStamp(community,destinationCountry){
 const stats=community?.statistics;
 if(!stats||typeof stats.sampleSize!=='number'||!Number.isFinite(stats.sampleSize)||stats.sampleSize<3||['US','United States'].includes(destinationCountry))return null;
 return scoreStamp(stats.percent);
}
function message(r){
 if(reasons[r.reason])return reasons[r.reason];
 const state=r.status||r.classification;
 if(state==='UNKNOWN'){
 const unknown=Object.entries(r.relevant_facts||{}).filter(([,f])=>f.state!=='KNOWN').map(([p])=>p.split('.').at(-1).replaceAll('_',' '));
 return unknown.length?'We could not determine this. Missing or invalid information: '+[...new Set(unknown)].join(', ')+'.':'This needs more information or review; it is not a failure.';
 }
 return {PASS:'The supplied facts meet this configured requirement.',WARNING:'This configured requirement needs attention or review.',FAIL:'The supplied facts do not meet this configured requirement. This is not a visa decision.',PRESENT:'Document/evidence reported present; acceptance still requires assessment.',MISSING:'Document/action appears outstanding. This does not predict visa refusal.',NOT_APPLICABLE:'This check does not apply to the supplied facts.',READY:'This preparation step is reported ready.',ACTION_REQUIRED:'An application or document action remains outstanding.',SUPPORTED:'This purpose is covered by the configured preview route.'}[state]||'Review this information with the application authority.';
}
function render(target,report,sources,community){
 target.replaceChildren();
 const el=(tag,text,parent=target)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent.append(n);return n;};
 const section=title=>{const n=el('section');n.className='report-section';el('h3',title,n);return n;};
 const sourceLinks=(r,parent)=>{const linked=(r.source_refs||[]).map(ref=>sources[ref.path]).filter(s=>s&&/^https:\/\//.test(s.url||''));if(!linked.length)return;const details=el('details',undefined,parent);details.className='source-details';el('summary','Official sources · verification pending',details);for(const s of linked){const a=el('a','Official source: '+s.title+' (verification pending)',details);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';a.className='source-link';}};
 const row=(r,parent)=>{const n=el('article',undefined,parent);n.className='result-row';el('h4',label(r),n);const state=r.status||r.classification||'UNKNOWN';const icon=el('span',({PASS:'✓',PRESENT:'✓',READY:'✓',WARNING:'!',FAIL:'!',MISSING:'!',ACTION_REQUIRED:'!',UNKNOWN:'?',NOT_APPLICABLE:'—'})[state]||'·',n);icon.className='status-icon status-'+state;icon.setAttribute('aria-hidden','true');const badge=el('span',state.replaceAll('_',' '),n);badge.className='status status-'+state;el('p',message(r),n);if(r.requirement)el('p',r.requirement,n);
 if(r.evidence_status==='EVIDENCE_REFRESH_REQUIRED')el('p','Current process — verification pending.',n);
 if(r.evidence_id==='SCHENGEN_INTENTION_INFORMATION')el('p','Intention to leave requires consular assessment; presence is not a credibility determination.',n);
 for(const d of r.diagnostics||[])if(d.code==='EVIDENCE_DATE_COVERAGE')el('p','Evidence date coverage: '+(d.coverage||'UNKNOWN').replaceAll('_',' ')+'.',n);
 sourceLinks(r,n);const debug=el('details',undefined,n);el('summary','Technical details',debug);el('pre',JSON.stringify(r,null,2),debug);return n;};
 const assessment=assessmentAPI.assessReport(report,community);
 const f=report.facts;const names={IN:'India',IE:'Ireland',FR:'France',ES:'Spain',GB:'United Kingdom',metropolitan_france:'Metropolitan France',short_stay:'Short stay',tourism:'Tourism',private_visit:'Private visit'};
 const cover=el('header');cover.className='report-cover';
 el('p','YOUR TRAVEL READINESS DOCUMENT',cover).className='report-kicker';
 el('h2','VisaCheck Report',cover);
 el('p','V1 development preview — evidence has not been independently verified for production.',cover).className='report-preview';
 const metadata=el('dl',undefined,cover);metadata.className='report-metadata';
 for(const [term,value] of [['Destination',f.trip.destination_country==='FR'?f.trip.destination_territory:f.trip.destination_country],['Purpose',f.trip.purpose],['Passport',report.route.route_id.split(':')[0]],['Residence',f.residence.country]]){const pair=el('div',undefined,metadata);el('dt',term,pair);el('dd',names[value]||(!value||value==='unknown'?'Unknown':value),pair);}
 const primary=el('section',undefined,cover);primary.className='score-summary primary-assessment';el('h3','VisaCheck profile',primary);
 const tone={STRONG_PROFILE:'green',NEEDS_ATTENTION:'amber',CHECK_REQUIRED:'amber',ATTENTION:'amber',PROFILE_NEEDS_WORK:'amber',REQUIREMENT_NOT_MET:'red'}[assessment.primary_status]||'unavailable';
 const stamp=el('div',undefined,primary);stamp.className='score-stamp stamp-'+tone;
 stamp.setAttribute('data-primary-status',assessment.primary_status);
 el('span',assessment.primary_status.replaceAll('_',' '),stamp).className='stamp-label';
 el('span','VisaCheck profile',stamp).className='stamp-caption';
 el('p',assessment.explanation.summary,primary).className='score-explanation';
 el('p','This is not a visa decision or guarantee. Clear configured checks do not establish visa eligibility.',primary).className='score-explanation';
 const official=section('Official profile checks');
 el('p',assessment.official.status.replaceAll('_',' '),official).className='official-summary';
 for(const r of assessment.explanation.contributors)el('p',r.label+' — '+r.status,official);
 if(assessment.official.blockers.length){const alert=el('aside',undefined,official);alert.className='official-alert';el('h4','Requirement not met',alert);el('p','The historical/community comparison does not override these official results.',alert);}
 for(const [key,title]of [['verification','Application verification'],['timing','Application timing']]){
 const summary=assessment[key],group=section(title);group.className+=' '+key+'-summary';
 el('p',summary.status.replaceAll('_',' '),group);
 for(const r of summary.contributing_results)el('p',r.label+' — '+(r.status==='UNKNOWN'?(key==='verification'?'Needs verification':'Not assessed'):r.status==='FAIL'?'Action required (FAIL)':r.status),group);
 if(summary.needs_attention){const alert=el('aside',undefined,primary);alert.className='official-alert application-action-alert';el('h4',title+' — action required',alert);for(const r of summary.contributing_results.filter(r=>['FAIL','WARNING'].includes(r.status)))el('p',r.label+' — review before applying.',alert);}
 }
 const profile=section('Historical / community comparison');
 const metric=el('p',assessment.community.available?assessment.community.score+' / 100 · '+assessment.community.sample_size+' records':'Comparison unavailable',profile);metric.className='community-metric';
 el('p',assessment.explanation.community_note,profile);
 el('p','Score source: COMMUNITY_MODEL. No combined probability or numerical confidence has been calculated.',profile);
 const readinessSummary=section('Application readiness summary');
 const rs=assessment.readiness;
 el('p',rs.ready+' ready · '+rs.needs_attention+' need attention · '+rs.unknown+' unknown · '+rs.not_applicable+' not applicable',readinessSummary);
 el('p','Counts describe configured evidence categories, not acceptance or a readiness percentage. Alternatives within a check count once.',readinessSummary);
 const completeness=section('Assessment completeness');
 el('p',assessment.completeness.replaceAll('_',' '),completeness);
 el('p','Completeness describes configured profile checks and readiness. Application verification and timing are reported separately; unresolved details remain outstanding. This is not the likelihood of approval. Research and publication status remain separate: DEVELOPMENT PREVIEW, verification pending.',completeness);
 const actions=section('Actions');
 for(const action of assessment.actions)el('p',action.result_ref.label+' — '+action.text,actions);
 if(!assessment.actions.length)el('p',assessment.primary_status==='UNSUPPORTED'?'No assessment actions are available for this unsupported route.':'No outstanding actions identified within the configured checks.',actions);
 section('Detailed checks and sources');
 const route=section('1. Route coverage');el('p',report.route.status+' — '+report.route.reason,route);
 el('p',[report.route.route_id.split(':')[0],f.residence.country,f.trip.destination_country==='FR'?f.trip.destination_territory:f.trip.destination_country,f.trip.visa_type,f.trip.purpose].map(v=>names[v]||v||'Unknown').join(' → '),route);
 el('p','Your travel dates: '+(f.trip.intended_entry_date||'Unknown')+' to '+(f.trip.intended_exit_date||'Unknown')+'.',route);
 if(f.trip.destination_country==='FR'&&!f.application.competent_state)el('p','Application jurisdiction needs review: France-only routing has not been established.',route);
 for(const a of report.route.assumptions)el('p',a,route);
 if(report.issues.length)el('p','Some inputs were malformed or conflicting and remain unknown. Correct them in the form.',route);
 const visa=section('2. Visa requirement');el('p',({ANNEX_I_VISA_REQUIRED:'Visa required — nationality baseline',ANNEX_II_VISA_EXEMPT:'Visa exempt — nationality baseline',UNKNOWN:'Unknown'})[report.baseline?.classification]||'Not evaluated for this route.',visa);el('p','Nationality baseline only; this is not an approval or refusal decision.',visa);if(report.baseline)sourceLinks(report.baseline,visa);
 const checks=section('A. Official Eligibility Checks');
 const groups=[['Passport',r=>r.rule_id.includes('TRAVEL_DOCUMENT')],['Stay',r=>r.rule_id.includes('90_IN_180')],['Residence',r=>r.rule_id.startsWith('FRANCE_IE')],['Insurance',r=>r.rule_id.includes('INSURANCE')],['Application timing',r=>r.rule_id.includes('LODGING')]];
 for(const [name,filter] of groups){const items=report.legal.filter(filter);if(items.length){el('h4',name,checks);items.forEach(r=>row(r,checks));}}
 const docs=section('B. Application Readiness');
 el('p','High-level declarations and evidence presence only. These do not establish legal sufficiency or consular acceptance.',docs);
 const declared=report.readiness_declarations?.insurance_full_trip;
 const declaration=el('article',undefined,docs);declaration.className='result-row';el('h4','Insurance for your full trip — your declaration',declaration);
 el('p',declared===true?'PRESENT — you report having Schengen insurance for the full trip. Detailed policy requirements remain unverified.':declared===false?'MISSING / NEEDS ATTENTION — you have not confirmed suitable full-trip insurance. This does not prove that you have no insurance policy.':'UNKNOWN — you have not confirmed full-trip insurance.',declaration);
 for(const r of report.documents.filter(r=>r.evidence_id.startsWith('SCHENGEN_')&&r.evidence_id!=='SCHENGEN_INSURANCE_EVIDENCE'))row(r,docs);
 const comm=section('C. Historical / Community Context');
 el('p','Historical/community-based; not an official decision or guarantee. Available samples may be small or unrepresentative.',comm);
 el('p',assessment.explanation.community_note,comm);
 for(const r of community?.reasons||[])el('p',r.reason+' ('+r.count+' cases)',comm);
 if(community?.issues?.length)el('p',community.issues.length+' dataset validation issue(s); ambiguous fields were retained as unknown.',comm);
 const attention=section('D. How to Strengthen Your Application');
 if(!report.attention.length)el('p',report.route.status==='UNSUPPORTED'?'This route is outside preview coverage.':'No outstanding evaluated items in the listed categories. This is not an overall visa verdict.',attention);
 for(const item of report.attention)el('p',item.section+': '+label(item.result)+' — '+(item.section==='Assessment'?'Consular assessment remains required.':message(item.result)),attention);
 if(declared!==true)el('p','Arrange or check your full-trip travel insurance. Review the policy requirements listed below.',attention);
 el('p','Review unknown checks against your documents. A check may remain unknown because this short questionnaire does not collect its detailed inputs.',attention);
 const next=section('E. Application Checklist / Next Steps');
 el('p','Preparation guidance, not unanswered application questions. This checklist is non-exhaustive; use the personal list supplied by France-Visas. Items below are not evidence that you have or have not completed a task.',next);
 for(const r of report.documents.filter(r=>!r.evidence_id.startsWith('SCHENGEN_')&&r.status!=='NOT_APPLICABLE')){
  el('h4',label(r),next);
  if(r.minimum_count)el('p','Draft checklist count: '+r.minimum_count.minimum+'. Confirm the document specifications in the official instructions.',next);
  for(const note of r.notes||[])el('p',note,next);
  if(r.evidence_status==='EVIDENCE_REFRESH_REQUIRED')el('p','Current process — verification pending.',next);
  sourceLinks(r,next);
 }
 const insuranceRules=report.legal.filter(r=>r.rule_id.includes('INSURANCE')&&r.status!=='NOT_APPLICABLE');
 if(insuranceRules.length){el('h4','Check your insurance policy',next);for(const r of insuranceRules){el('p',r.requirement||label(r),next);if(Number.isFinite(r.configured_parameters?.minimum)&&r.configured_parameters.required_unit)el('p','Configured minimum cover: '+r.configured_parameters.minimum+' '+r.configured_parameters.required_unit+'.',next);sourceLinks(r,next);}}
 if(report.procedure){
  el('h4','Application steps',next);
  for(const r of report.procedure.items)el('p',label(r)+' — check and complete this step according to the current application instructions.',next);
  el('p','Visa decision authority: '+report.procedure.decision_authority+'. Appointment/intake provider: '+report.procedure.intake_provider.name+' — current process, verification pending.',next);
  el('p','Documents outside English or French may need translation into French; confirm the current instructions. Verification pending.',next);
  sourceLinks(report.procedure,next);
  for(const info of report.procedure.operational_information){
   const text=info.kind==='OPERATIONAL_RECOMMENDATION'?`Recommended lead time: ${info.amount} working days. No deadline has been calculated.`:info.kind==='OPERATIONAL_ESTIMATE'?`Processing estimate: ${info.minimum}–${info.maximum} working days. Delays can occur; this is not guaranteed.`:info.code==='LATEST_LODGING_REQUIRES_REVIEW'?'Latest application timing remains under review; the earliest-lodging check does not establish that you are applying in time.':`Current passport return process — verification pending: ${info.currency} ${info.amount} stamped addressed envelope. Normal in-person collection is not reported available. Rejection handling differs; details need confirmation.`;
   el('p',text,next);sourceLinks(info,next);
  }
 }
 if(report.biometrics){
  el('h4','Biometrics and attendance',next);
  if(report.biometrics.identifiers?.photograph)el('p','The configured biometric identifiers include a photograph and '+report.biometrics.identifiers.fingerprints+' fingerprints, subject to the applicable procedure and exceptions.',next);
  const previous=f.biometrics.previous_schengen_biometrics_present;
  el('p',previous===true?'You reported previous Schengen fingerprints'+(f.biometrics.previous_biometrics_date?' collected on '+f.biometrics.previous_biometrics_date:'')+'. Reuse and attendance still need confirmation for the application.':previous===false?'You reported no previous Schengen fingerprints. Check collection and attendance instructions when preparing the application.':'Check biometric collection and attendance instructions when preparing the application.',next);
  sourceLinks(report.biometrics,next);
 }
 const limits=section('9. Important limitations');el('p','V1 covers a narrow ordinary-adult tourism route. Private visits have partial coverage. The checklist is non-exhaustive; the consular authority decides the visa application. Operational guidance can change. Evidence review, source verification and resolution of known gaps remain outstanding. Community statistics do not override official checks.',limits);
}
return {label,message,scoreStamp,communityScoreStamp,render};
});
