// Optional dependency-free browser smoke test. Requires local server :8765 and
// headless Chrome with --remote-debugging-port=9222 and a temporary profile.
const assert=require('node:assert/strict');
(async()=>{
const pages=await (await fetch('http://127.0.0.1:9222/json')).json();const page=pages.find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let next=0;const pending=new Map(),errors=[],failed=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);else if(m.method==='Network.responseReceived'&&m.params.response.status>=400)failed.push(m.params.response.url);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out: '+expression);};
try{
await send('Runtime.enable');await send('Network.enable');await send('Page.enable');
await send('Network.setCacheDisabled',{cacheDisabled:true});
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'about:blank'});
await until("location.href === 'about:blank' && document.readyState === 'complete'");
await send('Page.navigate',{url:'http://127.0.0.1:8765/check.html'});
await until("document.readyState === 'complete' && document.querySelector('#irp') !== null");
const {complete}=require('./v1-form-fixtures.cjs');
const fill=async values=>evaluate(`(()=>{const values=${JSON.stringify(values)};for(const [id,value] of Object.entries(values)){const input=document.getElementById(id);if(input)input.value=value;}document.getElementById('check-form').dispatchEvent(new Event('change',{bubbles:true}));})()`);
const hidden=async id=>evaluate(`document.getElementById(${JSON.stringify(id)}).closest('.form-row').hidden`);
// Capture the actual model, not just the success notice.
await evaluate("(()=>{const run=VisaCheckV1Integration.evaluate;VisaCheckV1Integration.evaluate=(...args)=>{const report=run(...args);window.__smokeReport=report;return report;};})()");
const submit=async()=>{
 await evaluate("document.querySelector('#check-form').requestSubmit()");
 await until("document.querySelector('#form-status').textContent.includes('Report ready') || document.querySelector('#form-status').textContent.includes('could not')");
 const rendered=await evaluate(`(()=>{
  const out=document.querySelector('#results'),style=getComputedStyle(out),rect=out.getBoundingClientRect();
  return {hidden:out.hidden,display:style.display,visibility:style.visibility,width:rect.width,height:rect.height,text:out.textContent.trim().length,
   modelKeys:Object.keys(window.__smokeReport||{}).length,legalCount:window.__smokeReport?.legal.length,
   sections:[...out.querySelectorAll('.report-section')].map(s=>({title:s.querySelector('h3').textContent,height:s.getBoundingClientRect().height})),status:document.querySelector('#form-status').textContent};
 })()`);
 assert.equal(rendered.hidden,false);assert.notEqual(rendered.display,'none','Report ready must mean CSS-visible report content');
 assert.ok(!['hidden','collapse'].includes(rendered.visibility));assert.ok(rendered.width>0&&rendered.height>0,'Report must occupy rendered space');
 assert.ok(rendered.text>0&&rendered.modelKeys>0);assert.ok(rendered.sections.every(s=>s.height>0));
 for(const name of ['A. Official Eligibility Checks','B. Application Readiness','C. Historical / Community Context','D. How to Strengthen Your Application','E. Application Checklist / Next Steps'])assert.ok(rendered.sections.some(s=>s.title===name),name);
 assert.match(rendered.status,/Report ready/);
 return rendered;
};
assert.equal(await evaluate("VisaCheckV1Fields.length"),35);
for(const id of ['return','activity','other_schengen','legal','amount','insurance_from','physical','completed','actual_lodging'])assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)})===null`),true);
await fill(complete());const normal=await submit();assert.ok(normal.legalCount>0);
await evaluate("document.getElementById('results').scrollIntoView({block:'start',behavior:'instant'})");
require('node:fs').writeFileSync('/tmp/visacheck-report-normal.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
let text=await evaluate("document.querySelector('#results').innerText");
assert.match(text,/SUPPORTED/);assert.match(text,/Visa required/);assert.match(text,/Official Eligibility Checks/);assert.match(text,/Application Readiness/);assert.match(text,/Historical \/ Community Context/);assert.match(text,/How to Strengthen Your Application/);assert.match(text,/Application Checklist \/ Next Steps/);assert.match(text,/Identity photos/);assert.match(text,/Draft checklist count: 2/);assert.match(text,/Approval rate among similar records|similar records/);
assert.ok(!text.includes('6. Return to Ireland'));assert.ok(await evaluate("document.querySelectorAll('#results .source-link').length>0"));
await fill({insurance:'no'});await submit();assert.match(await evaluate("document.querySelector('#results').innerText"),/MISSING \/ NEEDS ATTENTION/);
assert.equal(await evaluate("[...document.querySelectorAll('.result-row')].find(r=>r.querySelector('h4').textContent==='Insurance coverage amount').querySelector('.status').textContent"),'UNKNOWN');
await fill({accommodation:'PRIVATE_HOST'});assert.equal(await hidden('attestation'),false);await fill({attestation:'yes'});await fill({accommodation:'HOTEL'});assert.ok(await hidden('attestation'));assert.equal(await evaluate("document.getElementById('attestation').value"),'');
await fill({irp:'no'});assert.ok(await hidden('irp_expiry'));assert.equal(await evaluate("document.getElementById('irp_expiry').value"),'');await fill({irp:'yes'});assert.equal(await hidden('irp_expiry'),false);
await fill({residence:'GB'});assert.ok(await hidden('irp'));await fill({residence:'IE',irp:'yes'});
await fill({history:'yes'});assert.equal(await evaluate("document.getElementById('stay-history').hidden"),false);assert.ok(await hidden('history_complete'));await evaluate("document.querySelector('#stay-history > button').click()");assert.equal(await hidden('history_complete'),false);await fill({history:'no'});assert.equal(await evaluate("document.querySelectorAll('.stay-row').length"),0);
await fill({previous_bio:'yes'});assert.equal(await hidden('bio_date'),false);await fill({bio_date:'2029-01-01'});await fill({previous_bio:'no'});assert.ok(await hidden('bio_date'));assert.equal(await evaluate("document.getElementById('bio_date').value"),'');
await evaluate("document.querySelector('#check-form').reset()");
await new Promise(r=>setTimeout(r,30));
await fill({nationality:'IN',residence:'IE',document:'ordinary',destination:'FR',purpose:'tourism',age:'30',special:'no'});await submit();
text=await evaluate("document.querySelector('#results').innerText");assert.match(text,/PARTIAL/);assert.match(text,/UNKNOWN/);assert.match(text,/Application Checklist \/ Next Steps/);
await evaluate("document.getElementById('results').scrollIntoView({block:'start',behavior:'instant'})");
require('node:fs').writeFileSync('/tmp/visacheck-report-partial.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'));
await fill({destination:'ES'});await submit();assert.match(await evaluate("document.querySelector('#results').innerText"),/UNSUPPORTED/);
await evaluate("document.querySelector('#check-form').reset()");assert.ok(await evaluate("document.querySelector('#results').hidden && document.querySelector('#entry').value===''") );
await send('Page.reload');await until("document.querySelector('#irp') !== null");assert.equal(await evaluate("document.querySelector('#entry').value"),'');
assert.deepEqual(errors,[]);assert.deepEqual(failed.filter(u=>!u.endsWith('favicon.ico')),[]);
console.log('Browser smoke PASS: short tourism flow, partial/unknown report, insurance declaration, residence-specific controls, conditional history/host/biometrics, stale values, checklist outputs, sources, CSV, reset, refresh and 390px layout; zero uncaught JS or application-console errors.');
}finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
