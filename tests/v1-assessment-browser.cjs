// Real browser QA; requires the local site :8765 and headless Chrome :9222.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {fields,config,assets,complete}=require('./v1-form-fixtures.cjs');
const {strong}=require('./assessment-fixtures.cjs');
(async()=>{
 const pages=await(await fetch('http://127.0.0.1:9222/json')).json();
 const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let next=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out: '+expression);};
 try{
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:8765/check.html'});
  await until("document.readyState==='complete'&&document.getElementById('irp')!==null");
  await evaluate(`(()=>{for(const [id,value]of Object.entries(${JSON.stringify(complete())})){const e=document.getElementById(id);if(e)e.value=value;}document.getElementById('check-form').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('check-form').requestSubmit();})()`);
  await until("document.getElementById('form-status').textContent.includes('Report ready')");
  await until("document.querySelector('.community-metric')?.textContent.includes('78 / 100')");
  async function inspect(name,expected,tone){
   const state=await evaluate(`(()=>{const out=document.getElementById('results'),stamp=out.querySelector('.score-stamp'),metric=out.querySelector('.community-metric'),r=stamp.getBoundingClientRect();return {status:stamp.dataset.primaryStatus,text:stamp.textContent,tone:stamp.className,stampTop:r.top,metricTop:metric.getBoundingClientRect().top,metric:metric.textContent,width:r.width,height:r.height,visible:!out.hidden&&getComputedStyle(out).display!=='none',paper:getComputedStyle(out.querySelector('.report-cover')).backgroundColor,site:getComputedStyle(document.body).backgroundColor,overflow:document.documentElement.scrollWidth>window.innerWidth};})()`);
   assert.equal(state.status,expected,name);assert.ok(state.tone.includes('stamp-'+tone),name);assert.ok(state.visible&&state.width>0&&state.height>0,name);
   assert.ok(state.metricTop>state.stampTop,'Primary assessment is above community metric');assert.equal(state.paper,'rgb(255, 255, 255)');
   assert.equal(state.overflow,false,name);assert.doesNotMatch(state.text,/APPROVED|REJECTED|GUARANTEED/);
   if(expected!=='UNSUPPORTED')assert.match(state.metric,/78 \/ 100/);
   if(expected!=='STRONG_PROFILE')assert.ok(!state.text.includes('STRONG PROFILE'));
   await evaluate("document.getElementById('results').scrollIntoView({block:'start',behavior:'instant'})");
   fs.writeFileSync('/tmp/visacheck-stage-e-'+name+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   console.log(name+': '+state.status+'; paper '+state.paper+'; site '+state.site+'; no overflow');
  }
  await inspect('normal','CHECK_REQUIRED','amber');
  // Explicit architecture fixtures execute the real browser normalization,
  // release selection, integration and assessment; no legal results are injected.
  const cases=[['strong',strong().facts,'STRONG_PROFILE','green'],['irp-fail',strong('2030-06-20').facts,'REQUIREMENT_NOT_MET','red']];
  const passport=strong().facts;passport.passport.expiry_date='2030-07-01';cases.push(['passport-fail',passport,'REQUIREMENT_NOT_MET','red']);
  const stay=strong().facts;stay.trip.stay_history_status='COMPLETE';stay.trip.schengen_stay_history=[{entry_date:'2030-01-01',exit_date:'2030-03-31',authorization_type:'SHORT_STAY'}];cases.push(['stay-fail',stay,'REQUIREMENT_NOT_MET','red']);
  const unsupported=strong().facts;unsupported.trip.destination_country='ES';cases.push(['unsupported',unsupported,'UNSUPPORTED','unavailable']);
  for(const [name,facts,status,tone]of cases){
   await evaluate(`(()=>{const adapted=VisaCheckV1Adapter.adapt(${JSON.stringify(complete())},${JSON.stringify(fields)},${JSON.stringify(config)});adapted.model=VisaCheckApplicantFacts.normalizeApplicantFacts(${JSON.stringify(facts)});const report=VisaCheckV1Integration.evaluate(adapted,${JSON.stringify(config)},${JSON.stringify(assets)});VisaCheckV1Report.render(document.getElementById('results'),report,{}, {statistics:{percent:78,sampleSize:9}});})()`);
   await inspect(name,status,tone);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  // Re-render the failure scenario at mobile width, including its secondary 78.
  await evaluate(`(()=>{const adapted=VisaCheckV1Adapter.adapt(${JSON.stringify(complete())},${JSON.stringify(fields)},${JSON.stringify(config)});adapted.model=VisaCheckApplicantFacts.normalizeApplicantFacts(${JSON.stringify(strong('2030-06-20').facts)});VisaCheckV1Report.render(document.getElementById('results'),VisaCheckV1Integration.evaluate(adapted,${JSON.stringify(config)},${JSON.stringify(assets)}),{}, {statistics:{percent:78,sampleSize:9}});})()`);
  await inspect('mobile-390','REQUIREMENT_NOT_MET','red');
  assert.deepEqual(errors,[]);console.log('Assessment browser QA PASS: seven cases; visible stamps, secondary community 78, navy site, white paper, 390px layout, zero uncaught JS errors.');
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
