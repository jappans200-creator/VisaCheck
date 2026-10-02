// Canonical static preview controller. No legal calculations or thresholds here.
(function(){
'use strict';
const form=document.getElementById('check-form'),sections=document.getElementById('form-sections'),output=document.getElementById('results'),notice=document.getElementById('form-status'),submit=document.getElementById('check-submit');
const fields=VisaCheckV1Fields;
const node=(tag,text,parent)=>{const n=document.createElement(tag);if(text!==null)n.textContent=text;parent.append(n);return n;};
const sectionMap=new Map();
for(const f of fields){
 if(!sectionMap.has(f.section)){const d=node('details',null,sections);d.className='form-section';d.open=sectionMap.size===0;node('summary',f.section,d);sectionMap.set(f.section,d);}
 const row=node('div',null,sectionMap.get(f.section));row.className='form-row';row.dataset.field=f.id;node('label',f.label,row).htmlFor=f.id;
 const select=f.type==='boolean'||f.type==='select';const input=node(select?'select':'input',null,row);input.id=f.id;input.name=f.id;
 if(select){node('option','Unsure / not supplied',input).value='';for(const [value,label] of f.type==='boolean'?[['yes','Yes'],['no','No']]:f.options)node('option',label,input).value=value;}
 else{input.type=['date','number'].includes(f.type)?f.type:'text';if(f.type==='number'){input.min='0';input.step='any';}}
 if(f.help){const help=node('small',f.help,row);help.id=f.id+'-help';help.className='field-help';input.setAttribute('aria-describedby',help.id);}
}
// Follow-ups are activated by evaluated material dependencies, never by country branches.
const followupPanel=node('section',null,sections);followupPanel.id='material-followups';followupPanel.className='form-section';followupPanel.hidden=true;
let followupAnswers={},enabledFollowups=[],questionConfig=null,scopeKey=null,dynamicSubmit=false;
function resetFollowups(){followupAnswers={};enabledFollowups=[];followupPanel.replaceChildren();followupPanel.hidden=true;}
function renderFollowups(report){
 enabledFollowups=VisaCheckMaterialQuestions.resolve(report,questionConfig,followupAnswers);
 if(!enabledFollowups.includes('origin'))delete followupAnswers.origin;
 if(!enabledFollowups.includes('return'))for(const key of ['return','return_country','return_date'])delete followupAnswers[key];
 followupPanel.replaceChildren();followupPanel.hidden=!enabledFollowups.length;
 if(followupPanel.hidden)return;
 node('h3','Official profile follow-up',followupPanel);
 const unresolved=report.legal.some(r=>r.status==='UNKNOWN'&&report.assessment_configuration.results.some(b=>b.result_id===r.rule_id&&b.role==='BLOCKING'&&b.material));
 node('p',unresolved?'We need a few more details to complete an official profile check.':'Your follow-up answers are included below. You can change them here.',followupPanel);
 const control=(key,label,type,options)=>{
  const row=node('div',null,followupPanel);row.className='form-row';node('label',label,row).htmlFor='followup-'+key;
  const input=node(type==='date'?'input':'select',null,row);input.id='followup-'+key;input.name=input.id;
  if(type==='date')input.type='date';else{node('option','Unsure / not supplied',input).value='';for(const [code,name]of options)node('option',name,input).value=code;}
  input.value=followupAnswers[key]||'';
  input.addEventListener('change',()=>{followupAnswers=VisaCheckMaterialQuestions.change(followupAnswers,key,input.value);dynamicSubmit=true;form.requestSubmit();});
 };
 if(enabledFollowups.includes('origin'))control('origin','Country of origin','country',VisaCheckCountryOptions);
 if(enabledFollowups.includes('return')){
  control('return','After this trip, are you returning to your country of residence?','select',[['yes','Yes'],['no','No / onward travel']]);
  if(followupAnswers.return==='no')control('return_country','Country of intended return (after any onward travel)','country',VisaCheckCountryOptions);
  if(followupAnswers.return==='yes'||followupAnswers.return==='no'&&followupAnswers.return_country)control('return_date','On what date will you return?','date');
  if(followupAnswers.return==='no')node('p','Supply your intended return country and date if known. Onward travel is not assumed to be a return to your residence; an unresolved residence-return check still needs review.',followupPanel);
 }
}
const historySection=sectionMap.get('Travel History');
const historyPanel=node('div',null,historySection);historyPanel.id='stay-history';
const stays=node('div',null,historyPanel);const add=node('button','Add previous stay',historyPanel);add.type='button';
historyPanel.append(document.getElementById('history_complete').closest('.form-row'));
function currentValues(){
 const values=Object.fromEntries(fields.map(f=>[f.id,document.getElementById(f.id).value]));
 values.stays=[...stays.children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-stay]')].map(i=>[i.dataset.stay,i.value])));
 return values;
}
function addStay(){
 const row=node('fieldset',null,stays);row.className='stay-row';node('legend','Previous stay',row);
 for(const [key,label] of [['entry_date','Entry date'],['exit_date','Exit date'],['authorization_type','Authorization type']]){
  const lab=node('label',label,row),input=node(key==='authorization_type'?'select':'input',null,lab);input.dataset.stay=key;
  if(key==='authorization_type'){for(const [value,text] of [['UNKNOWN','Unsure'],['SHORT_STAY','Short stay'],['RESIDENCE_PERMIT','Residence permit'],['LONG_STAY_VISA','Long-stay visa']])node('option',text,input).value=value;}else input.type='date';
 }
 const remove=node('button','Remove stay',row);remove.type='button';remove.onclick=()=>{row.remove();document.getElementById('history_complete').value='';conditional();};
 document.getElementById('history_complete').value='';conditional();
}
add.onclick=addStay;
function conditional(){
 const values=currentValues();
 for(const f of fields){
  const input=document.getElementById(f.id),show=VisaCheckV1Adapter.isVisible(f,values,fields);
  input.closest('.form-row').hidden=!show;input.disabled=!show;
  if(!show)input.value='';
 }
 historyPanel.hidden=values.history!=='yes';
 if(historyPanel.hidden)stays.replaceChildren();
 document.getElementById('purpose-note').hidden=values.purpose!=='private_visit';
}
form.addEventListener('change',event=>{
 if(event.target.closest('.stay-row'))document.getElementById('history_complete').value='';
 const currentScope=JSON.stringify(['nationality','residence','destination','purpose','document','special','age'].map(id=>document.getElementById(id).value));
 if(scopeKey!==null&&scopeKey!==currentScope){resetFollowups();generation++;submit.disabled=false;output.hidden=true;output.replaceChildren();notice.textContent='Your profile changed. Create an updated report.';}
 scopeKey=currentScope;
 conditional();
});
conditional();
async function json(path){const response=await fetch(path);if(!response.ok)throw new Error('Could not load '+path);return response.json();}
let loadPromise;
function load(){
 if(!loadPromise)loadPromise=(async()=>{
  const config=await json('data/official-requirements/integration/v1-preview.json');
  config.releases=await VisaCheckRuntimeRelease.loadRegistry(config.runtime_releases,json);
  if(config.question_configuration){questionConfig=VisaCheckMaterialQuestions.validate(await json(config.question_configuration.path),config.question_configuration);}
  return config;
 })().catch(error=>{loadPromise=null;throw error;});
 return loadPromise;
}
const selectedLoads=new Map();
function loadSelected(selection){
 const key=JSON.stringify(selection.asset_refs);
 if(!selectedLoads.has(key))selectedLoads.set(key,readSelected(selection).catch(error=>{selectedLoads.delete(key);throw error;}));
 return selectedLoads.get(key);
}
async function readSelected(selection){
 const assets=await VisaCheckRuntimeRelease.loadAssets(selection,json);
 const refs=new Set();
 const walk=v=>{if(!v||typeof v!=='object')return;if(v.source_id&&v.path)refs.add(v.path);Object.values(v).forEach(walk);};
 walk(assets);
 const sources={};
 await Promise.all([...refs].map(async path=>{try{sources[path]=await json(path);}catch{/* Existing optional display-copy policy: pinned provenance stays on results. */}}));
 return {assets,sources};
}
let dataset={records:[],issues:[],state:'loading'};
const communityLoad=fetch('data/visa_outcomes.csv').then(r=>{if(!r.ok)throw new Error('Dataset load failed');return r.text();}).then(text=>{dataset={...ingestOutcomeCSV(text),state:'loaded'};}).catch(()=>{dataset.state='unavailable';});
function community(values){
 if(dataset.state!=='loaded')return {message:'Community dataset '+dataset.state+'.',issues:[]};
 const country={IN:'India',IE:'Ireland',FR:'France',ES:'Spain',GB:'United Kingdom'};
 const profile={nationality:country[values.nationality]||null,residence:country[values.residence]||null,destination:country[values.destination]||null,permitType:values.permit_type||null,monthsRemaining:monthsRemaining(values.irp_expiry),countriesVisited:nonNegativeNumber(values.visited,true),priorRejection:values.refusal==='yes'?'Yes':values.refusal==='no'?'No':null,otherVisas:values.other_visas?.trim()?values.other_visas.split(',').map(v=>v.trim()):null};
 const sample=selectSample(dataset.records,profile),stats=computeApproval(sample);
 let message=stats.sampleSize>=3&&profile.destination!=='United States'?`Approval rate among similar records: ${stats.percent}% (${stats.sampleSize} records).`:`${stats.sampleSize} similar records — too few or insufficiently representative to show a percentage.`;
 if(stats.sampleSize>=3&&stats.sampleSize<8)message+=' Small sample; treat this as rough, not precise.';
 return {message,reasons:topRejectionReasons(sample),issues:dataset.issues,statistics:stats};
}
let generation=0;
function showReportError(error){
 output.hidden=true;
 output.replaceChildren();
 notice.textContent='The report could not be displayed. Please try again.';
 console.error('VisaCheck report evaluation/rendering failed:',error);
}
function renderReport(report,sources,communityValues){
 output.replaceChildren();
 VisaCheckV1Report.render(output,report,sources,community(communityValues));
 if(!output.querySelector('h2')||!output.querySelector('.report-section')||!output.textContent.trim())throw new Error('Report renderer did not produce report content');
 output.hidden=false;
 const style=getComputedStyle(output),rect=output.getBoundingClientRect();
 if(style.display==='none'||['hidden','collapse'].includes(style.visibility)||style.opacity==='0'||rect.width<=0||rect.height<=0)throw new Error('Rendered report is not visible');
 notice.textContent='Report ready. This preview is not a visa decision.';
}
form.addEventListener('submit',async event=>{event.preventDefault();const token=++generation;submit.disabled=true;notice.textContent='Preparing your report…';output.hidden=true;
 try{const config=await load();if(token!==generation)return;
 const values=currentValues();
 const adapted=VisaCheckMaterialQuestions.apply(VisaCheckV1Adapter.adapt(values,fields,config),followupAnswers,enabledFollowups);
 const {assets,sources}=await loadSelected(VisaCheckV1Integration.select(adapted,config));
 if(token!==generation)return;
 const communityValues={...adapted.active_values,permit_type:adapted.model.facts.residence.permit_type,irp_expiry:adapted.model.facts.residence.irish_residence_card_expiry_date};
 let report=VisaCheckV1Integration.evaluate(adapted,config,assets);
 const nextFollowups=VisaCheckMaterialQuestions.resolve(report,questionConfig,followupAnswers);
 if(enabledFollowups.some(key=>!nextFollowups.includes(key))){
  // Clear inactive answers before producing the final canonical report as well.
  renderFollowups(report);
  report=VisaCheckV1Integration.evaluate(VisaCheckMaterialQuestions.apply(VisaCheckV1Adapter.adapt(values,fields,config),followupAnswers,enabledFollowups),config,assets);
 }
 renderFollowups(report);
 renderReport(report,sources,communityValues);
 if(dataset.state==='loading')communityLoad.then(()=>{if(token===generation&&!output.hidden)renderReport(report,sources,communityValues);}).catch(error=>{if(token===generation)showReportError(error);});
 if(!dynamicSubmit)output.focus();dynamicSubmit=false;
 try{localStorage.setItem('visacheck_check_count',String(Number(localStorage.getItem('visacheck_check_count')||0)+1));}catch{/* Storage is optional; applicant facts are never persisted. */}
 }catch(error){if(token===generation)showReportError(error);}finally{if(token===generation)submit.disabled=false;}});
form.addEventListener('reset',()=>{generation++;submit.disabled=false;resetFollowups();stays.replaceChildren();output.replaceChildren();output.hidden=true;notice.textContent='Form reset. No applicant data is saved by VisaCheck.';setTimeout(conditional,0);});
})();
