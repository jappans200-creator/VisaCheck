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
const historySection=sectionMap.get('Previous Schengen Travel');
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
 conditional();
});
conditional();
async function json(path){const response=await fetch(path);if(!response.ok)throw new Error('Could not load '+path);return response.json();}
let loadPromise;
function load(){if(!loadPromise)loadPromise=(async()=>{const config=await json('data/official-requirements/integration/v1-preview.json');const assets=Object.fromEntries(await Promise.all(Object.entries(config.assets).map(async([id,path])=>[id,await json(path)])));const refs=new Set();const walk=v=>{if(!v||typeof v!=='object')return;if(v.source_id&&v.path)refs.add(v.path);Object.values(v).forEach(walk);};walk(assets);const sources={};await Promise.all([...refs].map(async path=>{try{sources[path]=await json(path);}catch{/* A missing source link must not invent a URL or change evaluation. */}}));return {config,assets,sources};})().catch(error=>{loadPromise=null;throw error;});return loadPromise;}
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
form.addEventListener('submit',async event=>{event.preventDefault();const token=++generation;submit.disabled=true;notice.textContent='Preparing your report…';output.hidden=true;
 try{const {config,assets,sources}=await load();if(token!==generation)return;
 const values=currentValues();
 const adapted=VisaCheckV1Adapter.adapt(values,fields,config);
 const communityValues={...adapted.active_values,permit_type:adapted.model.facts.residence.permit_type,irp_expiry:adapted.model.facts.residence.irish_residence_card_expiry_date};
 const report=VisaCheckV1Integration.evaluate(adapted,config,assets);
 VisaCheckV1Report.render(output,report,sources,community(communityValues));output.hidden=false;
 if(dataset.state==='loading')communityLoad.then(()=>{if(token===generation&&!output.hidden)VisaCheckV1Report.render(output,report,sources,community(communityValues));});
 notice.textContent='Report ready. This preview is not a visa decision.';output.focus();
 try{localStorage.setItem('visacheck_check_count',String(Number(localStorage.getItem('visacheck_check_count')||0)+1));}catch{/* Storage is optional; applicant facts are never persisted. */}
 }catch(error){notice.textContent='The report could not be loaded. Please try again. '+error.message;}finally{if(token===generation)submit.disabled=false;}});
form.addEventListener('reset',()=>{generation++;submit.disabled=false;stays.replaceChildren();output.replaceChildren();output.hidden=true;notice.textContent='Form reset. No applicant data is saved by VisaCheck.';setTimeout(conditional,0);});
})();
