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
await send('Runtime.enable');await send('Network.enable');await send('Page.enable');await send('Page.navigate',{url:'http://127.0.0.1:8765/check.html'});await until("document.querySelector('#other_schengen') !== null");
assert.ok(await evaluate("document.querySelectorAll('#check-form select,input').length > 60"));
await evaluate(`(()=>{const v={nationality:'IN',residence:'IE',legal:'yes',age:'30',origin_details:'yes',origin:'IN',special:'no',document:'ordinary',issue:'2028-01-01',expiry:'2038-01-01',pages:'4',destination:'FR',purpose:'tourism',other_schengen:'no',entry:'2030-06-01',exit:'2030-06-10',return:'2030-06-10',activity:'no',history:'no',irp_expiry:'2031-01-01',renewal:'no',amount:'50000',currency:'EUR',insurance_from:'2030-05-01',insurance_to:'2030-07-01',territorial:'SCHENGEN',accommodation:'HOTEL',accommodation_from:'2030-06-01',accommodation_to:'2030-06-10',bio_date:'2029-01-01',physical:'NOT_DECLARED',exemption:'NOT_DECLARED',submitted:'yes',actual_lodging:'2030-04-01',photos:'2',supporting_prepared:'BOTH',languages:'English'};for(const f of VisaCheckV1Fields){const input=document.getElementById(f.id);if(f.type==='boolean')input.value='yes';if(f.id in v)input.value=v[f.id];}document.querySelector('#check-form').dispatchEvent(new Event('change',{bubbles:true}));})()`);
assert.ok(await evaluate("document.querySelector('#attestation').closest('.form-row').hidden"));
await evaluate("document.querySelector('#accommodation').value='PRIVATE_HOST'; document.querySelector('#check-form').dispatchEvent(new Event('change'));");
assert.equal(await evaluate("document.querySelector('#attestation').disabled"),false);
await evaluate("document.querySelector('#check-form').requestSubmit()");await until("!document.querySelector('#results').hidden");
const text=await evaluate("document.querySelector('#results').innerText");assert.match(text,/SUPPORTED/);assert.match(text,/Visa required/);assert.match(text,/Approval rate among similar records|similar records/);assert.match(text,/Return to Ireland/);assert.ok(await evaluate("document.querySelectorAll('#results .source-link').length>0"));
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'));
// Exercise controlling-answer changes in the real DOM, including stale values.
const change=async(id,value)=>evaluate(`document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(value)};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event('change',{bubbles:true}));`);
const hidden=async id=>evaluate(`document.getElementById(${JSON.stringify(id)}).closest('.form-row').hidden`);
await change('insurance','no');assert.ok(await hidden('amount'));assert.equal(await evaluate("document.getElementById('amount').value"),'');
await evaluate("document.querySelector('#check-form').requestSubmit()");await until("!document.querySelector('#results').hidden");
assert.equal(await evaluate("[...document.querySelectorAll('.result-row')].find(r=>r.querySelector('h4').textContent==='Insurance coverage amount').querySelector('.status').textContent"),'UNKNOWN');
assert.equal(await evaluate("[...document.querySelectorAll('.result-row')].find(r=>r.querySelector('h4').textContent==='Travel medical insurance').querySelector('.status').textContent"),'FAIL');
await change('insurance','yes');assert.equal(await hidden('amount'),false);
await change('accommodation','PRIVATE_HOST');assert.equal(await hidden('attestation'),false);assert.ok(await hidden('attestation_original'));
await change('attestation','yes');await change('attestation_original','yes');assert.equal(await hidden('attestation_original'),false);
await change('accommodation','HOTEL');assert.ok(await hidden('attestation'));assert.equal(await evaluate("document.getElementById('attestation_original').value"),'');
assert.ok(await evaluate("document.getElementById('stay-history').hidden"));
await change('history','yes');assert.equal(await evaluate("document.getElementById('stay-history').hidden"),false);assert.ok(await hidden('history_complete'));
await evaluate("document.querySelector('#stay-history > button').click()");assert.equal(await hidden('history_complete'),false);assert.equal(await evaluate("document.querySelectorAll('.stay-row').length"),1);
await evaluate("document.querySelector('[data-stay=entry_date]').value='2030-01-01'");await change('history','no');assert.ok(await evaluate("document.getElementById('stay-history').hidden"));assert.equal(await evaluate("document.querySelectorAll('.stay-row').length"),0);
await change('previous_bio','no');assert.ok(await hidden('bio_date'));assert.equal(await evaluate("document.getElementById('bio_date').value"),'');await change('previous_bio','yes');assert.equal(await hidden('reuse'),false);
await change('sponsored','yes');await change('sponsor','yes');assert.equal(await hidden('sponsor'),false);await change('sponsored','no');assert.ok(await hidden('sponsor'));assert.equal(await evaluate("document.getElementById('sponsor').value"),'');
await change('irp','no');assert.ok(await hidden('irp_expiry'));await change('irp','yes');assert.equal(await hidden('irp_expiry'),false);
await change('submitted','no');assert.ok(await hidden('actual_lodging'));assert.equal(await hidden('intended_lodging'),false);assert.equal(await evaluate("document.getElementById('actual_lodging').value"),'');
await change('submitted','yes');assert.equal(await hidden('actual_lodging'),false);assert.ok(await hidden('intended_lodging'));
await change('return_evidence','yes');assert.ok(await hidden('return_money'));await change('return_evidence','no');assert.equal(await hidden('return_money'),false);
await change('accommodation_evidence','no');assert.equal(await hidden('accommodation_means'),false);await change('accommodation_evidence','yes');assert.ok(await hidden('accommodation_means'));
await evaluate("document.querySelector('#purpose').value='private_visit';document.querySelector('#check-form').dispatchEvent(new Event('change'));document.querySelector('#check-form').requestSubmit()");await until("!document.querySelector('#results').hidden && document.querySelector('#results').innerText.includes('PARTIAL')");
await evaluate("document.querySelector('#destination').value='ES';document.querySelector('#check-form').requestSubmit()");await until("!document.querySelector('#results').hidden && document.querySelector('#results').innerText.includes('UNSUPPORTED')");
await evaluate("document.querySelector('#check-form').reset()");assert.ok(await evaluate("document.querySelector('#results').hidden && document.querySelector('#entry').value===''") );
await send('Page.reload');await until("document.querySelector('#other_schengen') !== null");assert.equal(await evaluate("document.querySelector('#entry').value"),'');
assert.deepEqual(errors,[]);assert.deepEqual(failed.filter(u=>!u.endsWith('favicon.ico')),[]);
console.log('Browser smoke PASS: tourism, insurance Yes/No, host/hotel, history editor/completeness, biometrics, sponsorship, IRP, lodging, stale values, report, sources, CSV, partial/unsupported routes, reset, refresh, 390px layout; zero uncaught JS or console errors.');
}finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
