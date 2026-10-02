// Real browser QA; requires the local site :8766 and headless Chrome :9222.
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
 const until=async expression=>{for(let i=0;i<300;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out: '+expression);};
 try{
  await send('Runtime.discardConsoleEntries');await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:(process.env.VISACHECK_QA_URL||'http://127.0.0.1:8766')+'/check.html'});
  await until("document.readyState==='complete'&&document.getElementById('irp')!==null");
  await evaluate("(()=>{const original=VisaCheckV1Integration.evaluate;VisaCheckV1Integration.evaluate=(...args)=>{const report=original(...args);window.qaReport=report;return report;};})()");
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
   fs.writeFileSync('/tmp/visacheck-stage-d-'+name+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   console.log(name+': '+state.status+'; paper '+state.paper+'; site '+state.site+'; no overflow');
  }
  await inspect('normal','CHECK_REQUIRED','amber');
  async function change(id,value,automatic=false){
   await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)throw Error('Missing control '+${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));${automatic?'':"document.getElementById('check-form').requestSubmit();"}})()`);
   await until("document.getElementById('form-status').textContent.includes('Report ready')");
  }
  async function checkQuestions(expected){const ids=await evaluate("[...document.querySelectorAll('#material-followups select,#material-followups input')].map(n=>n.id)");assert.deepEqual(ids,expected.map(x=>'followup-'+x));}
  await checkQuestions(['origin']);
  await change('followup-origin','IN',true);await checkQuestions(['origin','return']);
  await change('followup-return','yes',true);await checkQuestions(['origin','return','return_date']);
  assert.equal(await evaluate("document.getElementById('followup-return_date').value"),'');
  await change('followup-return_date','2030-06-10',true);await inspect('return-pass','STRONG_PROFILE','green');
  await change('irp_expiry','2030-12-10');await inspect('six-month','STRONG_PROFILE','green');
  await change('followup-return_date','2030-06-15',true);await inspect('different-date','STRONG_PROFILE','green');
  await change('irp_expiry','2030-06-20');await inspect('ten-day','REQUIREMENT_NOT_MET','red');
  await change('followup-return','no',true);await checkQuestions(['origin','return','return_country']);await inspect('onward-unspecified','CHECK_REQUIRED','amber');
  await change('followup-return_country','GB',true);assert.equal(await evaluate("document.getElementById('followup-return_date').value"),'');
  await change('followup-return_date','2030-06-10',true);await inspect('onward','CHECK_REQUIRED','amber');
  await change('followup-origin','IE',true);await checkQuestions(['origin']);assert.equal(await evaluate('qaReport.facts.trip.intended_return_date'),null);assert.equal(await evaluate('qaReport.facts.trip.return_destination_country'),null);await inspect('origin-residence','STRONG_PROFILE','green');
  await change('followup-origin','',true);await inspect('missing-origin','CHECK_REQUIRED','amber');
  await change('destination','ES');await checkQuestions([]);await inspect('unsupported','UNSUPPORTED','unavailable');
  await change('destination','FR');await checkQuestions(['origin']);assert.equal(await evaluate("document.getElementById('followup-origin').value"),'');
  await change('followup-origin','IN',true);await change('followup-return','yes',true);await change('followup-return_date','2030-06-10',true);
  await change('residence','GB');await checkQuestions([]);assert.equal(await evaluate('qaReport.facts.identity.country_of_origin'),null);assert.equal(await evaluate('qaReport.facts.trip.intended_return_date'),null);assert.equal(await evaluate("document.getElementById('irp').value"),'');assert.equal(await evaluate("document.getElementById('irp_expiry').value"),'');
  await change('residence','IE');await change('irp','yes');await change('irp_expiry','2030-12-10');await checkQuestions(['origin']);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await change('followup-origin','IN',true);await change('followup-return','yes',true);await change('followup-return_date','2030-06-10',true);await inspect('mobile-390','STRONG_PROFILE','green');
  await evaluate("document.getElementById('material-followups').scrollIntoView({block:'start',behavior:'instant'})");
  fs.writeFileSync('/tmp/visacheck-stage-d-followups-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"),false);
  assert.deepEqual(errors,[]);console.log('Stage D browser QA PASS: origin, return, different date, onward, six-month/ten-day expiry, equal origin, missing origin, unsupported, residence reset, mobile 390; zero uncaught errors.');
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
